import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  supabase,
  isSyncEnabled,
  getSupabaseProjectRef,
  parseJwtProjectRefFromAccessToken,
  signOutLocallyIfCorruptRefreshToken,
} from './supabaseClient';
import { normalize } from '../utils/normalize';
import { logger } from '../utils/logger';
import type { CategorizeItemResult, ParseRecipeResponse, ParsedListItem } from '../types/api';
import type { ZoneKey } from '../types/models';
import { MAX_RECIPE_AI_INPUT } from '../constants/textLimits';
import {
  getCachedCategorySync,
  putCachedCategories,
  type CachedCategoryEntry,
} from './aiCategoryCache';

/** Response body is unread until we clone (FunctionsHttpError carries the raw Response). */
async function readFunctionsHttpErrorDetails(
  error: unknown
): Promise<{ status: number; bodySnippet: string } | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  const res = error.context as Response;
  try {
    const text = await res.clone().text();
    return { status: res.status, bodySnippet: text.slice(0, 800) };
  } catch {
    return { status: res.status, bodySnippet: '(body unreadable)' };
  }
}

function userFacingCategorizeMessage(details: { status: number; bodySnippet: string } | null): string {
  const status = details?.status;
  if (status === 429) {
    return 'Too many requests right now. Try again in a little while.';
  }
  if (status === 401) {
    return 'Sign in again to categorize items.';
  }
  if (status === 400) {
    return 'Could not categorize those items. Try shorter lines or fewer items at once.';
  }
  if (status === 503 || status === 502 || status === 500) {
    return 'Classification is temporarily unavailable. Try again later.';
  }
  return 'Could not categorize items. Try again.';
}

function parseEdgeErrorMessage(bodySnippet: string | undefined): string | null {
  if (!bodySnippet) return null;
  try {
    const j = JSON.parse(bodySnippet) as { error?: unknown; message?: unknown };
    const msg = typeof j.error === 'string' ? j.error : typeof j.message === 'string' ? j.message : null;
    if (msg && msg.trim()) return msg.trim();
  } catch {
    /* ignore */
  }
  return null;
}

function userFacingParseRecipeMessage(details: { status: number; bodySnippet: string } | null): string {
  const status = details?.status;
  const fromBody = parseEdgeErrorMessage(details?.bodySnippet);
  if (status === 429) {
    return 'AI recipe parsing is temporarily rate-limited. Please try again later.';
  }
  if (status === 401) {
    return 'Sign in again to use AI recipe parsing.';
  }
  if (status === 400) {
    return fromBody ?? 'Could not parse that recipe text. Try shorter or cleaner text.';
  }
  if (status === 503 || status === 502 || status === 500) {
    return fromBody ?? 'AI recipe parsing is temporarily unavailable. Please try again.';
  }
  return fromBody ?? 'Could not parse recipe text. Try again.';
}

export interface CategorizeItemsResponse {
  results: CategorizeItemResult[];
  cache_hits?: number;
  cache_misses?: number;
}

export async function categorizeItems(
  rawItems: string[],
  _storeType?: string,
  /** Human-readable store section labels in walking order (from the current list / store layout). */
  zoneLabelsInOrder?: string[]
): Promise<CategorizeItemsResponse> {
  if (!isSyncEnabled()) {
    const results: CategorizeItemResult[] = rawItems.map((input) => ({
      input,
      normalized_name: normalize(input),
      category: 'other',
      zone_key: 'other',
      confidence: 0,
    }));
    return { results, cache_hits: 0, cache_misses: 0 };
  }

  // Resolve anything we already know locally so we can skip the network round-trip
  // entirely (or send only the uncached subset to the edge function).
  const cachedByIdx: (CachedCategoryEntry | null)[] = rawItems.map((raw) =>
    getCachedCategorySync(raw)
  );
  const missIndices: number[] = [];
  const missInputs: string[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    if (!cachedByIdx[i]) {
      missIndices.push(i);
      missInputs.push(rawItems[i]);
    }
  }

  if (missInputs.length === 0) {
    const results: CategorizeItemResult[] = rawItems.map((raw, i) => {
      const entry = cachedByIdx[i]!;
      return {
        input: raw,
        normalized_name: entry.normalized_name,
        category: entry.category,
        zone_key: entry.zone_key,
        confidence: 1,
      };
    });
    return { results, cache_hits: rawItems.length, cache_misses: 0 };
  }

  const invokeBody = {
    items: missInputs,
    storeType: _storeType,
    ...(zoneLabelsInOrder?.length ? { zoneLabelsInOrder } : {}),
  };

  const {
    data: { session: initialSession },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr) {
    if (await signOutLocallyIfCorruptRefreshToken(sessionErr)) {
      throw new Error('Sign in again to categorize items.');
    }
    throw new Error('Sign in required to categorize items (session could not be loaded).');
  }
  let session = initialSession;

  if (!session?.access_token) {
    throw new Error('Sign in required to categorize items (no access token).');
  }

  const cfgRef = getSupabaseProjectRef();
  const jwtRef = parseJwtProjectRefFromAccessToken(session.access_token);
  if (
    jwtRef &&
    cfgRef !== 'not-configured' &&
    cfgRef !== 'unknown' &&
    cfgRef !== 'custom-host' &&
    cfgRef !== 'local' &&
    jwtRef !== cfgRef
  ) {
    throw new Error(
      'This session does not match this app build. Sign out and sign in again, or reinstall the app from the same environment.'
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (session.expires_at != null && session.expires_at - nowSec < 120) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr && (await signOutLocallyIfCorruptRefreshToken(refreshErr))) {
      throw new Error('Sign in again to categorize items.');
    }
    if (!refreshErr) {
      session = refreshed.session ?? session;
    }
  }

  if (!session?.access_token) {
    throw new Error('Session expired; sign in again to categorize items.');
  }

  /** Let fetchWithAuth set Authorization from getAccessToken() (same path as PostgREST). */
  const invokeCategorize = () =>
    supabase.functions.invoke('categorize-items', { body: invokeBody });

  let { data, error } = await invokeCategorize();

  if (error) {
    const details = await readFunctionsHttpErrorDetails(error);

    // Gateway / session: refresh once then retry (e.g. expired access token).
    if (details?.status === 401) {
      const { data: refData, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr && (await signOutLocallyIfCorruptRefreshToken(refreshErr))) {
        throw new Error('Sign in again to categorize items.');
      }
      if (refData.session) session = refData.session;
      if (!refreshErr && session?.access_token) {
        const second = await invokeCategorize();
        data = second.data;
        error = second.error;
      }
    }
  }

  if (error) {
    const details = await readFunctionsHttpErrorDetails(error);
    if (__DEV__ && details) {
      logger.warn('categorize-items', details.status, details.bodySnippet.slice(0, 200));
    }
    throw new Error(userFacingCategorizeMessage(details));
  }

  const networkResults: CategorizeItemResult[] = Array.isArray(data?.results) ? data.results : [];
  if (networkResults.length !== missInputs.length) {
    throw new Error('Could not categorize items. Try again.');
  }

  // Persist every row the edge function just returned so the next add with the same
  // normalized name skips the network entirely. Fire-and-forget — never blocks the caller.
  void putCachedCategories(
    networkResults.map((r) => ({
      normalized_name: r.normalized_name,
      zone_key: r.zone_key as ZoneKey,
      category: r.category,
    }))
  );

  // Stitch cache hits + network results back into the original caller-visible order.
  const merged: CategorizeItemResult[] = new Array(rawItems.length);
  for (let i = 0; i < rawItems.length; i++) {
    const entry = cachedByIdx[i];
    if (entry) {
      merged[i] = {
        input: rawItems[i],
        normalized_name: entry.normalized_name,
        category: entry.category,
        zone_key: entry.zone_key,
        confidence: 1,
      };
    }
  }
  for (let j = 0; j < missIndices.length; j++) {
    merged[missIndices[j]] = networkResults[j];
  }

  return {
    results: merged,
    cache_hits: rawItems.length - missInputs.length,
    cache_misses: missInputs.length,
  };
}

export async function parseRecipeFromText(recipeText: string): Promise<ParseRecipeResponse> {
  const preparedText = recipeText.trim();
  if (!preparedText) {
    throw new Error('Recipe text is required.');
  }
  if (preparedText.length > MAX_RECIPE_AI_INPUT) {
    throw new Error('Recipe text is too long. Please shorten it and try again.');
  }

  const invokeParse = () =>
    supabase.functions.invoke('parse-recipe', {
      body: {
        recipeText: preparedText,
      },
    });

  let { data, error } = await invokeParse();

  if (error) {
    const details = await readFunctionsHttpErrorDetails(error);
    if (details?.status === 401) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr && (await signOutLocallyIfCorruptRefreshToken(refreshErr))) {
        throw new Error('Sign in again to use AI recipe parsing.');
      }
      if (!refreshErr) {
        const second = await invokeParse();
        data = second.data;
        error = second.error;
      }
    }
  }

  if (error) {
    const details = await readFunctionsHttpErrorDetails(error);
    if (__DEV__ && details) {
      logger.warn('parse-recipe', details.status, details.bodySnippet.slice(0, 200));
    }
    throw new Error(userFacingParseRecipeMessage(details));
  }

  const recipe = data?.recipe;
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('Could not parse recipe text. Try again.');
  }

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  return {
    recipe: { ...recipe, ingredients },
    cache_hit: data?.cache_hit === true,
  };
}

/**
 * AI-parse free-form shopping text into reviewable rows with quantities, units, and zones.
 *
 * Implemented as a client-side chain of two existing edge functions (no new backend):
 *   1. `parse-recipe` extracts ingredient names + quantities + units (ignores recipe-only fields
 *      like servings/title which users don't provide for shopping descriptions).
 *   2. `categorize-items` maps each extracted name to a `zone_key` using the user's store layout.
 *
 * If parse-recipe fails, the whole call fails (surfaces the same user-friendly error string as
 * the recipe import flow). If categorize-items fails AFTER parse succeeds, we fall back to
 * `zone_key: 'other'` for every row so the user still gets a useful review sheet instead of a
 * hard error — they can re-categorize manually in the review step.
 */
function userFacingSmartAddMessage(details: { status: number; bodySnippet: string } | null): string {
  const status = details?.status;
  const fromBody = parseEdgeErrorMessage(details?.bodySnippet);
  if (status === 429) {
    return 'Smart add is temporarily rate-limited. Please try again later.';
  }
  if (status === 401) {
    return 'Sign in again to use Smart add.';
  }
  if (status === 400) {
    return fromBody ?? 'Could not parse that description. Try shorter or cleaner text.';
  }
  if (status === 503 || status === 502 || status === 500) {
    return fromBody ?? 'Smart add is temporarily unavailable. Please try again.';
  }
  return fromBody ?? 'Could not understand that description. Try again.';
}

/**
 * Detects the Supabase-level "Requested function was not found" 404 that fires when
 * the `smart-add` edge function isn't deployed yet. Used to trigger a graceful
 * fallback to the legacy `parse-recipe` → `categorize-items` chain so Smart Add keeps
 * working during the staged rollout.
 */
function isFunctionNotFoundError(
  details: { status: number; bodySnippet: string } | null
): boolean {
  if (!details) return false;
  if (details.status !== 404) return false;
  const msg = parseEdgeErrorMessage(details.bodySnippet) ?? details.bodySnippet;
  return /function was not found|not found/i.test(msg ?? '');
}

/**
 * Legacy chain fallback: `parse-recipe` + `categorize-items`.
 *
 * Used automatically when `smart-add` returns 404 (not deployed yet) so users
 * aren't blocked during the rollout window. Once `smart-add` is live in Supabase
 * the primary path below handles it with a single round-trip.
 */
async function parseListItemsFromTextLegacyChain(
  text: string,
  storeType: string | undefined,
  zoneLabelsInOrder: string[] | undefined
): Promise<ParsedListItem[]> {
  let recipe;
  try {
    ({ recipe } = await parseRecipeFromText(text));
  } catch (e) {
    // `parse-recipe` errors mention "recipe" because that's the primary use case; rephrase
    // for Smart Add context while preserving rate-limit / auth wording.
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg
        .replace(/AI recipe parsing is temporarily rate-limited/i, 'Smart add is temporarily rate-limited')
        .replace(/to use AI recipe parsing/i, 'to use Smart add')
        .replace(/AI recipe parsing is temporarily unavailable/i, 'Smart add is temporarily unavailable')
        .replace(/Could not parse that recipe text\./i, 'Could not parse that description.')
        .replace(/Could not parse recipe text\./i, 'Could not understand that description.')
    );
  }
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  const cleaned = ingredients
    .map((ing) => {
      const name = (ing.name ?? '').trim();
      if (!name) return null;
      const qty =
        ing.quantity_value != null &&
        typeof ing.quantity_value === 'number' &&
        !Number.isNaN(ing.quantity_value) &&
        ing.quantity_value > 0
          ? ing.quantity_value
          : 1;
      const unit = (ing.quantity_unit ?? '').trim() || 'ea';
      return { name, quantity: qty, unit };
    })
    .filter((row): row is { name: string; quantity: number; unit: string } => row !== null);

  if (cleaned.length === 0) {
    throw new Error(
      "Didn't catch any items — try rephrasing or tap the sparkle to go back to single-item mode."
    );
  }

  const names = cleaned.map((r) => r.name);
  let categorized: CategorizeItemResult[] | null = null;
  try {
    const res = await categorizeItems(names, storeType, zoneLabelsInOrder);
    if (res.results.length === names.length) {
      categorized = res.results;
    }
  } catch (e) {
    if (__DEV__) {
      logger.warn('parseListItemsFromText legacy: categorize fallback', e);
    }
  }

  return cleaned.map((row, i) => {
    const cat = categorized?.[i];
    return {
      name: row.name,
      normalized_name: cat?.normalized_name ?? normalize(row.name),
      quantity: row.quantity,
      unit: row.unit,
      zone_key: (cat?.zone_key as ZoneKey | undefined) ?? 'other',
      category: cat?.category ?? 'other',
    };
  });
}

/**
 * Smart Add: parse + categorize in a single edge-function hop.
 *
 * Used by `QuickAddComposer` smart mode. Invokes the `smart-add` edge function for
 * a single OpenAI round-trip. On success we also populate the local `aiCategoryCache`
 * so subsequent single-item adds of the same names hit the instant-insert fast path.
 *
 * Rollout safety: if `smart-add` returns 404 (not yet deployed), we transparently
 * fall back to the legacy `parse-recipe` + `categorize-items` chain so users aren't
 * blocked during the staged deploy. Once `smart-add` is live the fast path takes over
 * automatically with zero client change required.
 */
export async function parseListItemsFromText(
  text: string,
  storeType?: string,
  zoneLabelsInOrder?: string[]
): Promise<ParsedListItem[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Describe what you need to add.');
  }
  if (trimmed.length > MAX_RECIPE_AI_INPUT) {
    throw new Error('That description is too long. Shorten it and try again.');
  }

  if (!isSyncEnabled()) {
    // Offline / sync-disabled builds can't reach the edge function. The composer
    // treats this like any other error and falls back to single-item mode.
    throw new Error('Smart add is unavailable offline. Try again when connected.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    signOutLocallyIfCorruptRefreshToken(sessionError);
    throw new Error('Sign in again to use Smart add.');
  }
  if (!session?.access_token) {
    throw new Error('Sign in again to use Smart add.');
  }

  // Protect against silent project-ref drift (anon key + session from different projects
  // produces opaque 401s). Mirrors the guard in `categorizeItems`.
  const projectRef = getSupabaseProjectRef();
  const tokenRef = parseJwtProjectRefFromAccessToken(session.access_token);
  if (projectRef && tokenRef && projectRef !== tokenRef) {
    throw new Error('Sign in again to use Smart add.');
  }

  let data: { items?: unknown } | null = null;
  try {
    const res = await supabase.functions.invoke<{ items: ParsedListItem[] }>('smart-add', {
      body: {
        text: trimmed,
        ...(storeType ? { storeType } : {}),
        ...(zoneLabelsInOrder?.length ? { zoneLabelsInOrder } : {}),
      },
    });
    if (res.error) {
      throw res.error;
    }
    data = res.data ?? null;
  } catch (e) {
    const details = await readFunctionsHttpErrorDetails(e);
    // Graceful rollout: if the new edge function isn't deployed, fall back to the
    // legacy chain so Smart Add keeps working in the meantime.
    if (isFunctionNotFoundError(details)) {
      if (__DEV__) {
        logger.warn('smart-add not deployed; falling back to parse-recipe + categorize-items');
      }
      return parseListItemsFromTextLegacyChain(trimmed, storeType, zoneLabelsInOrder);
    }
    if (details) {
      throw new Error(userFacingSmartAddMessage(details));
    }
    const msg = e instanceof Error ? e.message : String(e);
    // Some Supabase client builds surface the 404 as a thrown Error rather than a
    // FunctionsHttpError with context; detect by message as a secondary safety net.
    if (/function was not found/i.test(msg)) {
      if (__DEV__) {
        logger.warn('smart-add not deployed (by message); falling back');
      }
      return parseListItemsFromTextLegacyChain(trimmed, storeType, zoneLabelsInOrder);
    }
    throw new Error(msg || 'Could not understand that description. Try again.');
  }

  const rawItems = Array.isArray(data?.items) ? (data!.items as unknown[]) : [];
  const items: ParsedListItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) continue;
    const normalizedRaw =
      typeof o.normalized_name === 'string' && o.normalized_name.trim()
        ? o.normalized_name.trim()
        : normalize(name);
    const quantityRaw = o.quantity;
    const quantity =
      typeof quantityRaw === 'number' && Number.isFinite(quantityRaw) && quantityRaw > 0
        ? quantityRaw
        : 1;
    const unitRaw = typeof o.unit === 'string' ? o.unit.trim() : '';
    const unit = unitRaw || 'ea';
    const zoneKey = (typeof o.zone_key === 'string' ? o.zone_key : 'other') as ZoneKey;
    const category = typeof o.category === 'string' && o.category.trim() ? o.category : 'other';
    items.push({
      name,
      normalized_name: normalizedRaw,
      quantity,
      unit,
      zone_key: zoneKey,
      category,
    });
  }

  if (items.length === 0) {
    throw new Error(
      "Didn't catch any items — try rephrasing or tap the sparkle to go back to single-item mode."
    );
  }

  // Populate the local category cache so subsequent single-item adds of these names
  // hit the optimistic fast path in HomeScreen.handleComposerSubmit.
  void putCachedCategories(
    items.map((i) => ({
      normalized_name: i.normalized_name,
      zone_key: i.zone_key,
      category: i.category,
    }))
  );

  return items;
}
