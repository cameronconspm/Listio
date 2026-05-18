import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  supabase,
  isSyncEnabled,
  signOutLocallyIfCorruptRefreshToken,
} from './supabaseClient';
import {
  getValidAccessTokenForEdgeInvoke,
  invalidateEdgeInvocationAuthCache,
  type EdgeAuthPurpose,
} from './edgeInvocationAuth';
import { normalize } from '../utils/normalize';
import { logger } from '../utils/logger';
import type { CategorizeItemResult, ParseRecipeResponse, ParsedListItem } from '../types/api';
import type { ZoneKey } from '../types/models';
import { MAX_RECIPE_AI_INPUT, MAX_RECIPE_URL } from '../constants/textLimits';
import {
  putCachedCategories,
  resolveCategoryFast,
  type FastCategoryEntry,
} from './aiCategoryCache';
import { canonicalGroceryKey } from './commonGroceryCatalog';
import { subscriptionPlatformEnforced } from '../constants/subscription';
import {
  ensureServerSubscriptionMirror,
  syncSubscriptionEntitlementToServer,
} from './subscriptionEntitlementSyncService';

export type PremiumHint = {
  isPremium: boolean;
  isLoading: boolean;
};

export type CategorizeItemsOptions = {
  premiumHint?: PremiumHint;
  /** When true (or known non-premium), assign `other` locally without edge RTT. */
  freeTierLocalOnly?: boolean;
};

const EDGE_INVOKE_TIMEOUT_MS = 55_000;

const categorizeInflight = new Map<string, Promise<CategorizeItemsResponse>>();

/** Clears in-flight categorize dedupe (tests). */
export function clearCategorizeInflight(): void {
  categorizeInflight.clear();
}

function categorizeDedupeKey(
  rawItems: string[],
  storeType: string | undefined,
  zoneLabelsInOrder: string[] | undefined
): string {
  const labels = (zoneLabelsInOrder ?? []).join('\x1e');
  const items = rawItems.map((r) => phraseKeyForCategorize(r)).sort().join('\x1e');
  return `${storeType ?? ''}\x1f${labels}\x1f${items}`;
}

function shouldSkipEdgeCategorize(options?: CategorizeItemsOptions): boolean {
  if (options?.freeTierLocalOnly) return true;
  const hint = options?.premiumHint;
  return hint != null && hint.isPremium === false && !hint.isLoading;
}

function buildFreeTierFallbackResults(
  rawItems: string[],
  cachedByIdx: (FastCategoryEntry | null)[]
): CategorizeItemResult[] {
  return rawItems.map((raw, i) => {
    const fast = cachedByIdx[i];
    if (fast) {
      return {
        input: raw,
        normalized_name: phraseKeyForCategorize(raw),
        category: fast.category,
        zone_key: fast.zone_key,
        confidence: fast.confidence,
      };
    }
    return {
      input: raw,
      normalized_name: phraseKeyForCategorize(raw),
      category: 'other',
      zone_key: 'other',
      confidence: 0,
    };
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Cancelled.');
  }
}

function invokeWithAbort<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  if (!signal) return fn();
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('Cancelled.'));
    signal.addEventListener('abort', onAbort, { once: true });
    fn()
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
}

async function invokeEdgeWithTimeout<T extends { data: unknown; error: unknown }>(
  invoke: () => Promise<T>,
  timeoutMessage: string,
  timeoutMs: number = EDGE_INVOKE_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<T> {
  throwIfAborted(signal);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await invokeWithAbort(
      () =>
        Promise.race([
          invoke(),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
          }),
        ]),
      signal
    );
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function invokeEdgeWithTimeoutAnd429Retry<T extends { data: unknown; error: unknown }>(
  invoke: () => Promise<T>,
  timeoutMessage: string,
  signal?: AbortSignal
): Promise<T> {
  let result = await invokeEdgeWithTimeout(invoke, timeoutMessage, EDGE_INVOKE_TIMEOUT_MS, signal);
  if (result.error) {
    const details = await readFunctionsHttpErrorDetails(result.error);
    if (details?.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 + Math.random() * 400));
      throwIfAborted(signal);
      result = await invokeEdgeWithTimeout(invoke, timeoutMessage, EDGE_INVOKE_TIMEOUT_MS, signal);
    }
  }
  return result;
}

/** Align Supabase mirror with RevenueCat before server-gated AI (paywall usually ran first). */
async function ensureServerMirrorBeforePremiumAi(premiumHint?: PremiumHint): Promise<void> {
  if (!isSyncEnabled() || !subscriptionPlatformEnforced()) return;
  if (premiumHint?.isPremium === true && !premiumHint.isLoading) return;
  await ensureServerSubscriptionMirror();
}

/** User-visible phrase preserved; this is only trim + lowercase collapse for cache/DB `normalized_name`. */
export function phraseKeyForCategorize(raw: string): string {
  return normalize(raw) || raw.trim();
}

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
    return 'Sign in again to sort items into sections.';
  }
  if (status === 400) {
    return 'Couldn’t sort those items into sections. Try shorter lines or fewer items at once.';
  }
  if (status === 504) {
    return 'Section suggestions took too long. Try again.';
  }
  if (status === 503 || status === 502 || status === 500) {
    return 'Section suggestions are temporarily unavailable. Try again later.';
  }
  return 'Couldn’t sort items into sections. Try again.';
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

function isPremiumRequiredDetails(details: { status: number; bodySnippet: string } | null): boolean {
  if (details?.status !== 403) return false;
  try {
    const j = JSON.parse(details.bodySnippet) as { code?: unknown };
    if (j.code === 'premium_required') return true;
  } catch {
    /* ignore */
  }
  return /premium_required|Listio\+ required/i.test(details.bodySnippet ?? '');
}

/** After a `premium_required` 403, mirror RevenueCat to Supabase and retry once. */
async function retryEdgeInvokeAfterPremiumSync<T extends { data: unknown; error: unknown }>(
  firstError: unknown,
  retry: () => Promise<T>
): Promise<T | null> {
  const details = await readFunctionsHttpErrorDetails(firstError);
  if (!isPremiumRequiredDetails(details)) return null;
  const sync = await syncSubscriptionEntitlementToServer();
  if (!sync?.isActive) return null;
  return retry();
}

const SESSION_REFRESH_SIGN_IN_MESSAGES: Record<EdgeAuthPurpose, string> = {
  categorizeItems: 'Sign in again to sort items into sections.',
  parseRecipeFromText: 'Sign in again to import recipes.',
  parseListItemsFromText: 'Sign in again to use Smart add.',
  syncSubscriptionEntitlement: 'Sign in again to refresh your subscription.',
};

/** On 401: refresh session, invalidate edge JWT cache, retry invoke once with a fresh token. */
async function retryEdgeInvokeAfterSessionRefresh<T extends { data: unknown; error: unknown }>(
  purpose: EdgeAuthPurpose,
  firstError: unknown,
  retry: (accessToken: string) => Promise<T>
): Promise<T | null> {
  const details = await readFunctionsHttpErrorDetails(firstError);
  if (details?.status !== 401) return null;

  const signInMsg = SESSION_REFRESH_SIGN_IN_MESSAGES[purpose];
  const { error: refreshErr } = await supabase.auth.refreshSession();
  if (refreshErr && (await signOutLocallyIfCorruptRefreshToken(refreshErr))) {
    throw new Error(signInMsg);
  }
  if (refreshErr) return null;

  invalidateEdgeInvocationAuthCache();
  const { accessToken: retryToken } = await getValidAccessTokenForEdgeInvoke(purpose);
  return retry(retryToken);
}

function userFacingParseRecipeMessage(details: { status: number; bodySnippet: string } | null): string {
  const status = details?.status;
  const fromBody = parseEdgeErrorMessage(details?.bodySnippet);
  if (status === 429) {
    return 'Recipe import is busy right now. Please try again later.';
  }
  if (status === 401) {
    return 'Sign in again to import recipes.';
  }
  if (status === 400) {
    return fromBody ?? 'Couldn’t read that recipe. Try shorter or cleaner text.';
  }
  if (status === 504) {
    return 'Recipe import took too long. Try again.';
  }
  if (status === 503 || status === 502 || status === 500) {
    return fromBody ?? 'Recipe import is temporarily unavailable. Please try again.';
  }
  if (status === 403) {
    return (
      fromBody ??
      'Listio+ is required for recipe import. Try Restore purchases in Settings.'
    );
  }
  return fromBody ?? 'Couldn’t read that recipe. Try again.';
}

export interface CategorizeItemsResponse {
  results: CategorizeItemResult[];
  cache_hits?: number;
  cache_misses?: number;
  fast_hits?: number;
  network_ms?: number;
  total_ms?: number;
  source_counts?: Record<string, number>;
}

/** Single __DEV__ log: perf + per-row resolution (via / local_source). */
function logCategorizeDevSummary(
  rawItems: string[],
  results: CategorizeItemResult[],
  cachedByIdx: (FastCategoryEntry | null)[],
  ctx: {
    networkInvoked: boolean;
    /** Set when logging the sync-disabled early return (uncached → other without edge). */
    syncDisabledBranch?: boolean;
    totalMs: number;
    networkMs?: number;
    sourceCounts: Record<string, number>;
    count: number;
    fastHits: number;
    networkMisses: number;
  }
): void {
  if (!__DEV__) return;
  const rows = rawItems.map((raw, i) => {
    const fast = cachedByIdx[i];
    const r = results[i];
    const via = ctx.networkInvoked && fast === null ? 'network' : 'local';
    let local_source: string | null = null;
    if (via === 'local') {
      if (fast) local_source = fast.source;
      else if (ctx.syncDisabledBranch) local_source = 'sync_off_uncached';
    }
    return {
      input: raw,
      phrase_key: r?.normalized_name,
      zone: r?.zone_key,
      category: r?.category,
      conf: r?.confidence,
      via,
      local_source,
    };
  });
  logger.info('categorizeItems', {
    perf: {
      count: ctx.count,
      fastHits: ctx.fastHits,
      networkMisses: ctx.networkMisses,
      totalMs: ctx.totalMs,
      ...(ctx.networkMs !== undefined ? { networkMs: ctx.networkMs } : {}),
      sourceCounts: ctx.sourceCounts,
    },
    rows,
  });
}

function incrementSourceCount(
  counts: Record<string, number>,
  source: string | undefined,
  by = 1
): void {
  if (!source) return;
  counts[source] = (counts[source] ?? 0) + by;
}

export async function categorizeItems(
  rawItems: string[],
  _storeType?: string,
  /** Human-readable store section labels in walking order (from the current list / store layout). */
  zoneLabelsInOrder?: string[],
  options?: CategorizeItemsOptions
): Promise<CategorizeItemsResponse> {
  const dedupeKey = categorizeDedupeKey(rawItems, _storeType, zoneLabelsInOrder);
  const inflight = categorizeInflight.get(dedupeKey);
  if (inflight) return inflight;

  const promise = categorizeItemsInner(rawItems, _storeType, zoneLabelsInOrder, options);
  categorizeInflight.set(dedupeKey, promise);
  try {
    return await promise;
  } finally {
    categorizeInflight.delete(dedupeKey);
  }
}

async function categorizeItemsInner(
  rawItems: string[],
  _storeType?: string,
  zoneLabelsInOrder?: string[],
  options?: CategorizeItemsOptions
): Promise<CategorizeItemsResponse> {
  const startedAt = Date.now();

  // Resolve anything we already know locally so we can skip the network round-trip
  // entirely (or send only the uncached subset to the edge function).
  const cachedByIdx: (FastCategoryEntry | null)[] = rawItems.map((raw) => resolveCategoryFast(raw));
  const sourceCounts: Record<string, number> = {};
  const missGroupsByKey = new Map<string, { input: string; indices: number[] }>();
  for (let i = 0; i < rawItems.length; i++) {
    const fast = cachedByIdx[i];
    if (fast) {
      incrementSourceCount(sourceCounts, fast.source);
    } else {
      const key = canonicalGroceryKey(rawItems[i]) || normalize(rawItems[i]) || rawItems[i];
      const existing = missGroupsByKey.get(key);
      if (existing) {
        existing.indices.push(i);
      } else {
        missGroupsByKey.set(key, { input: rawItems[i], indices: [i] });
      }
    }
  }
  const missGroups = Array.from(missGroupsByKey.values());
  const missInputs = missGroups.map((group) => group.input);
  const fastHitCount = rawItems.length - missGroups.reduce((sum, group) => sum + group.indices.length, 0);

  if (missInputs.length === 0) {
    const results: CategorizeItemResult[] = rawItems.map((raw, i) => {
      const entry = cachedByIdx[i]!;
      return {
        input: raw,
        normalized_name: phraseKeyForCategorize(raw),
        category: entry.category,
        zone_key: entry.zone_key,
        confidence: entry.confidence,
      };
    });
    const totalMs = Date.now() - startedAt;
    logCategorizeDevSummary(rawItems, results, cachedByIdx, {
      networkInvoked: false,
      totalMs,
      sourceCounts,
      count: rawItems.length,
      fastHits: rawItems.length,
      networkMisses: 0,
    });
    return {
      results,
      cache_hits: rawItems.length,
      cache_misses: 0,
      fast_hits: rawItems.length,
      total_ms: totalMs,
      source_counts: sourceCounts,
    };
  }

  if (!isSyncEnabled()) {
    const results: CategorizeItemResult[] = new Array(rawItems.length);
    for (let i = 0; i < rawItems.length; i++) {
      const fast = cachedByIdx[i];
      if (fast) {
        results[i] = {
          input: rawItems[i],
          normalized_name: phraseKeyForCategorize(rawItems[i]),
          category: fast.category,
          zone_key: fast.zone_key,
          confidence: fast.confidence,
        };
      } else {
        results[i] = {
          input: rawItems[i],
          normalized_name: phraseKeyForCategorize(rawItems[i]),
          category: 'other',
          zone_key: 'other',
          confidence: 0,
        };
      }
    }
    const totalMs = Date.now() - startedAt;
    const syncDisabledUncached = rawItems.length - fastHitCount;
    if (syncDisabledUncached > 0) {
      incrementSourceCount(sourceCounts, 'sync_disabled_uncached', syncDisabledUncached);
    }
    logCategorizeDevSummary(rawItems, results, cachedByIdx, {
      networkInvoked: false,
      syncDisabledBranch: true,
      totalMs,
      sourceCounts,
      count: rawItems.length,
      fastHits: fastHitCount,
      networkMisses: 0,
    });
    return {
      results,
      cache_hits: fastHitCount,
      cache_misses: syncDisabledUncached,
      fast_hits: fastHitCount,
      total_ms: totalMs,
      source_counts: sourceCounts,
    };
  }

  if (shouldSkipEdgeCategorize(options)) {
    const results = buildFreeTierFallbackResults(rawItems, cachedByIdx);
    const uncachedMisses = missGroups.reduce((sum, group) => sum + group.indices.length, 0);
    if (uncachedMisses > 0) {
      incrementSourceCount(sourceCounts, 'free_tier_local', uncachedMisses);
    }
    const totalMs = Date.now() - startedAt;
    logCategorizeDevSummary(rawItems, results, cachedByIdx, {
      networkInvoked: false,
      totalMs,
      sourceCounts,
      count: rawItems.length,
      fastHits: fastHitCount,
      networkMisses: 0,
    });
    return {
      results,
      cache_hits: fastHitCount,
      cache_misses: uncachedMisses,
      fast_hits: fastHitCount,
      total_ms: totalMs,
      source_counts: sourceCounts,
    };
  }

  const invokeBody = {
    items: missInputs,
    storeType: _storeType,
    ...(zoneLabelsInOrder?.length ? { zoneLabelsInOrder } : {}),
  };

  const { accessToken: firstToken } = await getValidAccessTokenForEdgeInvoke('categorizeItems');
  const invokeCategorize = (accessToken: string) =>
    supabase.functions.invoke('categorize-items', {
      body: invokeBody,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

  const networkStartedAt = Date.now();
  let { data, error } = await invokeEdgeWithTimeoutAnd429Retry(
    () => invokeCategorize(firstToken),
    'Section suggestions took too long. Try again.'
  );

  if (error) {
    const sessionRetry = await retryEdgeInvokeAfterSessionRefresh(
      'categorizeItems',
      error,
      invokeCategorize
    );
    if (sessionRetry) {
      data = sessionRetry.data;
      error = sessionRetry.error;
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
    throw new Error('Couldn’t sort items into sections. Try again.');
  }

  const edgeSourceCounts =
    data?.source_counts && typeof data.source_counts === 'object'
      ? (data.source_counts as Record<string, number>)
      : {};
  for (const [source, count] of Object.entries(edgeSourceCounts)) {
    incrementSourceCount(sourceCounts, source, count);
  }

  // Persist under each user phrase key so repeat adds with the same wording skip the network.
  void putCachedCategories(
    missGroups.flatMap((group, j) => {
      const r = networkResults[j];
      return group.indices.map((idx) => ({
        normalized_name: phraseKeyForCategorize(rawItems[idx]),
        zone_key: r.zone_key as ZoneKey,
        category: r.category,
      }));
    })
  );

  // Stitch cache hits + network results back into the original caller-visible order.
  const merged: CategorizeItemResult[] = new Array(rawItems.length);
  for (let i = 0; i < rawItems.length; i++) {
    const entry = cachedByIdx[i];
    if (entry) {
      merged[i] = {
        input: rawItems[i],
        normalized_name: phraseKeyForCategorize(rawItems[i]),
        category: entry.category,
        zone_key: entry.zone_key,
        confidence: entry.confidence,
      };
    }
  }
  for (let j = 0; j < missGroups.length; j++) {
    const networkResult = networkResults[j];
    for (const idx of missGroups[j].indices) {
      merged[idx] = {
        input: rawItems[idx],
        normalized_name: phraseKeyForCategorize(rawItems[idx]),
        category: networkResult.category,
        zone_key: networkResult.zone_key,
        confidence: networkResult.confidence,
      };
    }
  }

  const networkMs = Date.now() - networkStartedAt;
  const totalMs = Date.now() - startedAt;
  logCategorizeDevSummary(rawItems, merged, cachedByIdx, {
    networkInvoked: true,
    totalMs,
    networkMs,
    sourceCounts,
    count: rawItems.length,
    fastHits: fastHitCount,
    networkMisses: missInputs.length,
  });

  return {
    results: merged,
    cache_hits: fastHitCount,
    cache_misses: missInputs.length,
    fast_hits: fastHitCount,
    network_ms: networkMs,
    total_ms: totalMs,
    source_counts: sourceCounts,
  };
}

export async function parseRecipeFromText(
  recipeText: string,
  options?: { premiumHint?: PremiumHint; signal?: AbortSignal }
): Promise<ParseRecipeResponse> {
  const preparedText = recipeText.trim();
  if (!preparedText) {
    throw new Error('Recipe text is required.');
  }
  if (preparedText.length > MAX_RECIPE_AI_INPUT) {
    throw new Error('Recipe text is too long. Please shorten it and try again.');
  }

  throwIfAborted(options?.signal);
  await ensureServerMirrorBeforePremiumAi(options?.premiumHint);
  throwIfAborted(options?.signal);

  const { accessToken: parseToken } = await getValidAccessTokenForEdgeInvoke('parseRecipeFromText');
  const invokeParse = (accessToken: string) =>
    supabase.functions.invoke('parse-recipe', {
      body: {
        recipeText: preparedText,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

  let { data, error } = await invokeEdgeWithTimeoutAnd429Retry(
    () => invokeParse(parseToken),
    'Recipe import took too long. Try again.',
    options?.signal
  );

  if (error) {
    const sessionRetry = await retryEdgeInvokeAfterSessionRefresh(
      'parseRecipeFromText',
      error,
      invokeParse
    );
    if (sessionRetry) {
      data = sessionRetry.data;
      error = sessionRetry.error;
    }
  }

  if (error) {
    const premiumRetry = await retryEdgeInvokeAfterPremiumSync(error, async () => {
      const { accessToken } = await getValidAccessTokenForEdgeInvoke('parseRecipeFromText');
      return invokeEdgeWithTimeout(
        () => invokeParse(accessToken),
        'Recipe import took too long. Try again.'
      );
    });
    if (premiumRetry) {
      data = premiumRetry.data;
      error = premiumRetry.error;
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
    throw new Error('Couldn’t read that recipe. Try again.');
  }

  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  return {
    recipe: { ...recipe, ingredients },
    cache_hit: data?.cache_hit === true,
  };
}

/**
 * Fetch a recipe page server-side and parse it with the same pipeline as pasted text.
 * Uses the same edge auth purpose as `parseRecipeFromText` (single Supabase function).
 */
export async function parseRecipeFromUrl(
  recipeUrl: string,
  options?: { premiumHint?: PremiumHint; signal?: AbortSignal }
): Promise<ParseRecipeResponse> {
  const prepared = recipeUrl.trim();
  if (!prepared) {
    throw new Error('Recipe URL is required.');
  }
  if (prepared.length > MAX_RECIPE_URL) {
    throw new Error('URL is too long.');
  }

  throwIfAborted(options?.signal);
  await ensureServerMirrorBeforePremiumAi(options?.premiumHint);
  throwIfAborted(options?.signal);

  const { accessToken: parseToken } = await getValidAccessTokenForEdgeInvoke('parseRecipeFromText');
  const invokeParse = (accessToken: string) =>
    supabase.functions.invoke('parse-recipe', {
      body: {
        recipeUrl: prepared,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

  let { data, error } = await invokeEdgeWithTimeoutAnd429Retry(
    () => invokeParse(parseToken),
    'Recipe import took too long. Try again.',
    options?.signal
  );

  if (error) {
    const sessionRetry = await retryEdgeInvokeAfterSessionRefresh(
      'parseRecipeFromText',
      error,
      invokeParse
    );
    if (sessionRetry) {
      data = sessionRetry.data;
      error = sessionRetry.error;
    }
  }

  if (error) {
    const premiumRetry = await retryEdgeInvokeAfterPremiumSync(error, async () => {
      const { accessToken } = await getValidAccessTokenForEdgeInvoke('parseRecipeFromText');
      return invokeEdgeWithTimeout(
        () => invokeParse(accessToken),
        'Recipe import took too long. Try again.'
      );
    });
    if (premiumRetry) {
      data = premiumRetry.data;
      error = premiumRetry.error;
    }
  }

  if (error) {
    const details = await readFunctionsHttpErrorDetails(error);
    if (__DEV__ && details) {
      logger.warn('parse-recipe-url', details.status, details.bodySnippet.slice(0, 200));
    }
    throw new Error(userFacingParseRecipeMessage(details));
  }

  const recipe = data?.recipe;
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('Couldn’t import that recipe link. Try again.');
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
    return fromBody ?? 'Couldn’t understand that description. Try shorter or cleaner text.';
  }
  if (status === 504) {
    return 'Smart add took too long. Try again.';
  }
  if (status === 503 || status === 502 || status === 500) {
    return fromBody ?? 'Smart add is temporarily unavailable. Please try again.';
  }
  if (status === 403) {
    return fromBody ?? 'Listio+ is required for Smart add. Try Restore purchases in Settings.';
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
  zoneLabelsInOrder?: string[],
  options?: { premiumHint?: PremiumHint }
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
    throw new Error('Smart add needs an internet connection. Try again when you’re back online.');
  }

  await ensureServerMirrorBeforePremiumAi(options?.premiumHint);

  const { accessToken: smartToken } = await getValidAccessTokenForEdgeInvoke('parseListItemsFromText');

  let data: { items?: unknown } | null = null;
  const smartAddInvokeStarted = Date.now();
  const invokeSmartAdd = (accessToken: string) =>
    supabase.functions.invoke<{ items: ParsedListItem[] }>('smart-add', {
      body: {
        text: trimmed,
        ...(storeType ? { storeType } : {}),
        ...(zoneLabelsInOrder?.length ? { zoneLabelsInOrder } : {}),
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

  try {
    let res = await invokeEdgeWithTimeoutAnd429Retry(
      () => invokeSmartAdd(smartToken),
      'Smart add took too long. Try again.'
    );
    if (res.error) {
      const sessionRetry = await retryEdgeInvokeAfterSessionRefresh(
        'parseListItemsFromText',
        res.error,
        invokeSmartAdd
      );
      if (sessionRetry) res = sessionRetry;
    }
    if (res.error) {
      const premiumRetry = await retryEdgeInvokeAfterPremiumSync(res.error, async () => {
        const { accessToken } = await getValidAccessTokenForEdgeInvoke('parseListItemsFromText');
        return invokeSmartAdd(accessToken);
      });
      if (premiumRetry) res = premiumRetry;
    }
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
    const normalizedRaw = phraseKeyForCategorize(name);
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

  if (__DEV__) {
    const invokeMs = Date.now() - smartAddInvokeStarted;
    logger.info('smart-add', {
      perf: { invoke_ms: invokeMs, item_count: items.length },
      rows: items.map((i) => ({
        name: i.name,
        phrase_key: i.normalized_name,
        zone: i.zone_key,
        category: i.category,
        via: 'edge',
      })),
    });
  }

  // Populate the local category cache so subsequent single-item adds of these names
  // can insert after a synchronous cache hit in HomeScreen.handleComposerSubmit.
  void putCachedCategories(
    items.map((i) => ({
      normalized_name: i.normalized_name,
      zone_key: i.zone_key,
      category: i.category,
    }))
  );

  return items;
}
