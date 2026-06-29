/**
 * Aggregates distinct item names from household data for the suggestion index.
 */
import { supabase, isSyncEnabled } from './supabaseClient';
import { resolveDataScopeId } from './syncInsertScope';
import { getCachedCategoryDisplayNames } from './aiCategoryCache';
import { loadRecentItemsForSuggestions } from './recentItemsStore';
import * as local from './localDataService';
import { canonicalGroceryKey } from './commonGroceryCatalog';

export type SuggestionCorpusSource = 'recent' | 'list' | 'recipe' | 'meal' | 'cache';

export type SuggestionCorpusRow = {
  normalized_name: string;
  display_name: string;
  source: SuggestionCorpusSource;
  last_used_at?: number;
  frequency?: number;
};

function titleCaseWords(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function mergeRow(
  map: Map<string, SuggestionCorpusRow>,
  rawName: string,
  source: SuggestionCorpusSource,
  extras?: { last_used_at?: number; frequency?: number }
): void {
  const display = rawName.trim();
  if (!display) return;
  const key = canonicalGroceryKey(display) || display.toLowerCase();
  const existing = map.get(key);
  if (existing) {
    existing.frequency = (existing.frequency ?? 1) + (extras?.frequency ?? 1);
    if (extras?.last_used_at && (existing.last_used_at ?? 0) < extras.last_used_at) {
      existing.last_used_at = extras.last_used_at;
    }
    if (existing.source !== 'recent' && source === 'recent') {
      existing.source = 'recent';
    }
    return;
  }
  map.set(key, {
    normalized_name: key,
    display_name: titleCaseWords(display),
    source,
    last_used_at: extras?.last_used_at,
    frequency: extras?.frequency ?? 1,
  });
}

async function fetchCloudCorpus(limit: number): Promise<SuggestionCorpusRow[]> {
  const householdId = await resolveDataScopeId();
  const { data, error } = await supabase.rpc('fetch_household_suggestion_corpus', {
    p_household_id: householdId,
    p_limit: limit,
  });
  if (error || !data) return [];
  const rows: SuggestionCorpusRow[] = [];
  for (const row of data as { normalized_name: string; display_name: string; source: string }[]) {
    if (!row?.normalized_name || !row.display_name) continue;
    const source = row.source as SuggestionCorpusSource;
    if (!['list', 'recipe', 'meal'].includes(source)) continue;
    rows.push({
      normalized_name: row.normalized_name,
      display_name: row.display_name,
      source,
      frequency: 1,
    });
  }
  return rows;
}

async function loadAllLocalRecipeIngredientNames(userId: string): Promise<string[]> {
  const recipeIds = (await local.getRecipes(userId, {})).map((r) => r.id);
  if (recipeIds.length === 0) return [];
  const byRecipe = await local.getRecipeIngredientNamesByRecipeIds(recipeIds);
  const names: string[] = [];
  for (const list of byRecipe.values()) {
    names.push(...list);
  }
  return names;
}

async function loadAllLocalMealIngredientNames(userId: string): Promise<string[]> {
  const meals = await local.getMeals(userId);
  const names: string[] = [];
  for (const meal of meals) {
    const detail = await local.getMealWithIngredients(meal.id).catch(() => null);
    if (!detail) continue;
    for (const ing of detail.ingredients) {
      names.push(ing.name);
    }
  }
  return names;
}

async function fetchLocalCorpus(userId: string): Promise<SuggestionCorpusRow[]> {
  const map = new Map<string, SuggestionCorpusRow>();

  const [listItems, recipeNames, mealNames, recents] = await Promise.all([
    local.fetchListItems(userId),
    loadAllLocalRecipeIngredientNames(userId),
    loadAllLocalMealIngredientNames(userId),
    loadRecentItemsForSuggestions(),
  ]);

  for (const item of listItems) {
    mergeRow(map, item.name, 'list');
  }
  for (const name of recipeNames) {
    mergeRow(map, name, 'recipe');
  }
  for (const name of mealNames) {
    mergeRow(map, name, 'meal');
  }
  for (const recent of recents) {
    mergeRow(map, recent.display_name, 'recent', {
      last_used_at: recent.last_used_at,
      frequency: 1,
    });
  }
  for (const cached of getCachedCategoryDisplayNames()) {
    mergeRow(map, cached.display_name, 'cache');
  }

  return Array.from(map.values());
}

export async function fetchHouseholdSuggestionCorpus(
  userId: string,
  limit = 2000
): Promise<SuggestionCorpusRow[]> {
  const map = new Map<string, SuggestionCorpusRow>();

  if (isSyncEnabled()) {
    try {
      for (const row of await fetchCloudCorpus(limit)) {
        mergeRow(map, row.display_name, row.source, row);
      }
    } catch {
      // fall through to local merge
    }
  }

  for (const row of await fetchLocalCorpus(userId)) {
    mergeRow(map, row.display_name, row.source, row);
  }

  return Array.from(map.values()).slice(0, limit);
}

export async function rebuildHouseholdSuggestionIndex(userId: string): Promise<void> {
  const { rebuildSuggestionIndex } = await import('./suggestionIndexStore');
  const corpus = await fetchHouseholdSuggestionCorpus(userId);
  await rebuildSuggestionIndex(corpus);
}

let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced rebuild (2s) after list/recipe/meal mutations. */
export function scheduleSuggestionIndexRebuild(userId: string | undefined | null): void {
  if (!userId) return;
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    void rebuildHouseholdSuggestionIndex(userId).catch(() => undefined);
  }, 2000);
}
