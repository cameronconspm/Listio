import {
  canonicalGroceryKey,
  scoreSuggestionMatch,
  searchCatalogSuggestions,
} from './commonGroceryCatalog';
import type { RecentItem } from './recentItemsStore';
import { loadRecentItemsForSuggestions } from './recentItemsStore';

export type ItemNameSuggestionSource =
  | 'recent'
  | 'list'
  | 'cache'
  | 'recipe'
  | 'meal'
  | 'index'
  | 'catalog'
  | 'remote'
  | 'typed';

export type ItemNameSuggestion = {
  display_name: string;
  normalized_name: string;
  source: ItemNameSuggestionSource;
  last_unit?: string;
  last_used_at?: number;
  /** When true, row is "Add [query]" — user can still submit free text without selecting. */
  isTypedFallback?: boolean;
};

export const ITEM_NAME_SUGGESTION_UI_CAP = 5;
export const ITEM_NAME_CATALOG_FETCH_CAP = 24;

type RankedCandidate = ItemNameSuggestion & {
  tier: number;
  sourceRank: number;
};

function sourceRank(source: ItemNameSuggestionSource): number {
  if (source === 'recent') return 0;
  if (source === 'list') return 1;
  if (source === 'cache') return 2;
  if (source === 'recipe') return 3;
  if (source === 'meal') return 4;
  if (source === 'index') return 5;
  if (source === 'remote') return 6;
  if (source === 'catalog') return 7;
  if (source === 'typed') return 99;
  return 8;
}

function titleCaseWords(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function pushCandidate(
  candidates: RankedCandidate[],
  display: string,
  key: string,
  source: ItemNameSuggestionSource,
  lower: string,
  extras?: Pick<ItemNameSuggestion, 'last_unit' | 'last_used_at'>
): void {
  const tier = scoreSuggestionMatch(display.toLowerCase(), key, lower);
  if (tier === null) return;
  candidates.push({
    display_name: display,
    normalized_name: key,
    source,
    tier,
    sourceRank: sourceRank(source),
    ...extras,
  });
}

export type SearchItemNameSuggestionsOptions = {
  recentItems?: RecentItem[];
  listItemNames?: string[];
  cacheNames?: { display_name: string; normalized_name: string }[];
  recipeNames?: string[];
  mealNames?: string[];
  indexEntries?: { display_name: string; normalized_name: string; last_used_at?: number; frequency?: number }[];
  remoteNames?: { display_name: string; normalized_name: string }[];
  limit?: number;
  /** When true, append an "Add [query]" row if query is non-empty and not an exact match. */
  includeTypedFallback?: boolean;
};

/**
 * Merge recent history, personal corpus, and catalog into ranked suggestions.
 */
export function searchItemNameSuggestions(
  query: string,
  options: SearchItemNameSuggestionsOptions = {}
): ItemNameSuggestion[] {
  const trimmed = query.trim();
  const limit = options.limit ?? ITEM_NAME_SUGGESTION_UI_CAP;
  const lower = trimmed.toLowerCase();

  if (trimmed.length < 1) {
    return [];
  }

  const candidates: RankedCandidate[] = [];

  for (const item of options.recentItems ?? []) {
    const display = item.display_name.trim();
    if (!display) continue;
    const key = item.normalized_name || canonicalGroceryKey(display);
    pushCandidate(candidates, display, key, 'recent', lower, {
      last_unit: item.last_unit,
      last_used_at: item.last_used_at,
    });
  }

  for (const raw of options.listItemNames ?? []) {
    const display = raw.trim();
    if (!display) continue;
    const key = canonicalGroceryKey(display) || display.toLowerCase();
    pushCandidate(candidates, titleCaseWords(display), key, 'list', lower);
  }

  for (const row of options.cacheNames ?? []) {
    const display = row.display_name.trim();
    if (!display) continue;
    const key = row.normalized_name || canonicalGroceryKey(display);
    pushCandidate(candidates, titleCaseWords(display), key, 'cache', lower);
  }

  for (const raw of options.recipeNames ?? []) {
    const display = raw.trim();
    if (!display) continue;
    const key = canonicalGroceryKey(display) || display.toLowerCase();
    pushCandidate(candidates, titleCaseWords(display), key, 'recipe', lower);
  }

  for (const raw of options.mealNames ?? []) {
    const display = raw.trim();
    if (!display) continue;
    const key = canonicalGroceryKey(display) || display.toLowerCase();
    pushCandidate(candidates, titleCaseWords(display), key, 'meal', lower);
  }

  for (const row of options.indexEntries ?? []) {
    const display = row.display_name.trim();
    if (!display) continue;
    const key = row.normalized_name || canonicalGroceryKey(display);
    pushCandidate(candidates, titleCaseWords(display), key, 'index', lower, {
      last_used_at: row.last_used_at,
    });
  }

  for (const row of options.remoteNames ?? []) {
    const display = row.display_name.trim();
    if (!display) continue;
    const key = row.normalized_name || canonicalGroceryKey(display);
    pushCandidate(candidates, titleCaseWords(display), key, 'remote', lower);
  }

  for (const row of searchCatalogSuggestions(trimmed, ITEM_NAME_CATALOG_FETCH_CAP)) {
    const tier = scoreSuggestionMatch(row.display_name.toLowerCase(), row.normalized_name, lower);
    if (tier === null) continue;
    candidates.push({
      display_name: row.display_name,
      normalized_name: row.normalized_name,
      source: 'catalog',
      tier,
      sourceRank: sourceRank('catalog'),
    });
  }

  candidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank;
    const aTime = a.last_used_at ?? 0;
    const bTime = b.last_used_at ?? 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.display_name.localeCompare(b.display_name);
  });

  const deduped: ItemNameSuggestion[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const dedupeKey = c.normalized_name || canonicalGroceryKey(c.display_name);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push({
      display_name: c.display_name,
      normalized_name: dedupeKey,
      source: c.source,
      last_unit: c.last_unit,
      last_used_at: c.last_used_at,
    });
    if (deduped.length >= limit) break;
  }

  if (options.includeTypedFallback) {
    const exactMatch = deduped.some(
      (row) =>
        row.display_name.toLowerCase() === lower ||
        row.normalized_name === canonicalGroceryKey(trimmed)
    );
    if (!exactMatch) {
      deduped.push({
        display_name: titleCaseWords(trimmed),
        normalized_name: canonicalGroceryKey(trimmed) || lower,
        source: 'typed',
        isTypedFallback: true,
      });
    }
  }

  return deduped;
}

export async function searchItemNameSuggestionsAsync(
  query: string,
  options: Omit<SearchItemNameSuggestionsOptions, 'recentItems'> = {}
): Promise<ItemNameSuggestion[]> {
  const recentItems = await loadRecentItemsForSuggestions();
  return searchItemNameSuggestions(query, { ...options, recentItems });
}
