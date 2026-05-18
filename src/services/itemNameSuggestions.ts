import { canonicalGroceryKey, searchCatalogSuggestions } from './commonGroceryCatalog';
import type { RecentItem } from './recentItemsStore';
import { loadRecentItemsForSuggestions } from './recentItemsStore';

export type ItemNameSuggestionSource = 'recent' | 'list' | 'catalog';

export type ItemNameSuggestion = {
  display_name: string;
  normalized_name: string;
  source: ItemNameSuggestionSource;
  last_unit?: string;
  last_used_at?: number;
};

export const ITEM_NAME_SUGGESTION_UI_CAP = 5;

type RankedCandidate = ItemNameSuggestion & {
  tier: number;
  sourceRank: number;
};

function sourceRank(source: ItemNameSuggestionSource): number {
  if (source === 'recent') return 0;
  if (source === 'list') return 1;
  return 2;
}

function matchTier(displayLower: string, key: string, query: string): number | null {
  if (!query) return 2;
  if (displayLower.startsWith(query) || key.startsWith(query)) return 0;
  if (displayLower.includes(query) || key.includes(query)) return 1;
  return null;
}

function titleCaseWords(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Merge recent history, current list names, and catalog aliases into ranked suggestions.
 */
export function searchItemNameSuggestions(
  query: string,
  options: {
    recentItems?: RecentItem[];
    listItemNames?: string[];
    limit?: number;
  } = {}
): ItemNameSuggestion[] {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const lower = trimmed.toLowerCase();
  const limit = options.limit ?? ITEM_NAME_SUGGESTION_UI_CAP;
  const candidates: RankedCandidate[] = [];

  for (const item of options.recentItems ?? []) {
    const display = item.display_name.trim();
    if (!display) continue;
    const key = item.normalized_name || canonicalGroceryKey(display);
    const tier = matchTier(display.toLowerCase(), key, lower);
    if (tier === null) continue;
    candidates.push({
      display_name: display,
      normalized_name: key,
      source: 'recent',
      last_unit: item.last_unit,
      last_used_at: item.last_used_at,
      tier,
      sourceRank: sourceRank('recent'),
    });
  }

  const listNames = options.listItemNames ?? [];
  for (const raw of listNames) {
    const display = raw.trim();
    if (!display) continue;
    const key = canonicalGroceryKey(display) || display.toLowerCase();
    const tier = matchTier(display.toLowerCase(), key, lower);
    if (tier === null) continue;
    candidates.push({
      display_name: titleCaseWords(display),
      normalized_name: key,
      source: 'list',
      tier,
      sourceRank: sourceRank('list'),
    });
  }

  for (const row of searchCatalogSuggestions(trimmed, 12)) {
    const tier = matchTier(row.display_name.toLowerCase(), row.normalized_name, lower);
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

  return deduped;
}

export async function searchItemNameSuggestionsAsync(
  query: string,
  options: { listItemNames?: string[]; limit?: number } = {}
): Promise<ItemNameSuggestion[]> {
  const recentItems = await loadRecentItemsForSuggestions();
  return searchItemNameSuggestions(query, { ...options, recentItems });
}
