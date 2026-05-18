import type { ZoneKey } from './categorizeHelpers.ts';
import {
  canonicalGroceryKey as canonicalGroceryKeyCore,
  resolveCommonGroceryCategoryCore,
  resolveFromCategoryEntriesCore,
  tokensForFuzzyCacheLookup,
  type FastCategoryResult as CoreFastCategoryResult,
} from './groceryResolverCore.ts';

export type GroceryCategoryEntry = {
  normalized_name: string;
  zone_key: ZoneKey;
  category: string;
};

export type FastCategoryResult = Omit<CoreFastCategoryResult, 'zone_key'> & { zone_key: ZoneKey };

export { tokensForFuzzyCacheLookup };

export function canonicalGroceryKey(input: string): string {
  return canonicalGroceryKeyCore(input);
}

export function resolveCommonGroceryCategory(input: string): FastCategoryResult | null {
  const r = resolveCommonGroceryCategoryCore(input);
  return r ? { ...r, zone_key: r.zone_key as ZoneKey } : null;
}

export function resolveFromCategoryEntries(input: string, entries: GroceryCategoryEntry[]): FastCategoryResult | null {
  const r = resolveFromCategoryEntriesCore(input, entries);
  return r ? { ...r, zone_key: r.zone_key as ZoneKey } : null;
}
