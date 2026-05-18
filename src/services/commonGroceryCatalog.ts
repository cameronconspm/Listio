import type { ZoneKey } from '../types/models';
import {
  canonicalGroceryKey as canonicalGroceryKeyCore,
  resolveCommonGroceryCategoryCore,
  resolveFromCategoryEntriesCore,
  searchCatalogSuggestions as searchCatalogSuggestionsCore,
  type CatalogSuggestion as CoreCatalogSuggestion,
  type FastCategoryResult as CoreFastCategoryResult,
  type GroceryCategoryEntry as CoreGroceryCategoryEntry,
} from '../../shared/groceryResolverCore';

export type CatalogSuggestion = CoreCatalogSuggestion;

export function searchCatalogSuggestions(prefix: string, limit?: number): CatalogSuggestion[] {
  return searchCatalogSuggestionsCore(prefix, limit);
}

export type GroceryCategoryEntry = Omit<CoreGroceryCategoryEntry, 'zone_key'> & { zone_key: ZoneKey };

export type FastCategoryResult = Omit<CoreFastCategoryResult, 'zone_key'> & { zone_key: ZoneKey };

export function canonicalGroceryKey(input: string): string {
  return canonicalGroceryKeyCore(input);
}

export function resolveCommonGroceryCategory(input: string): FastCategoryResult | null {
  const r = resolveCommonGroceryCategoryCore(input);
  return r ? { ...r, zone_key: r.zone_key as ZoneKey } : null;
}

export function resolveFromCategoryEntries(input: string, entries: GroceryCategoryEntry[]): FastCategoryResult | null {
  const r = resolveFromCategoryEntriesCore(input, entries as CoreGroceryCategoryEntry[]);
  return r ? { ...r, zone_key: r.zone_key as ZoneKey } : null;
}
