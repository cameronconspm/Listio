import { COMMON_GROCERY_CATALOG } from '../shared/commonGroceryCatalogData';
import type { ZoneKey } from '../src/types/models';
import {
  canonicalGroceryKey,
  resolveCommonGroceryCategory,
  resolveFromCategoryEntries,
} from '../src/services/commonGroceryCatalog';
import {
  canonicalGroceryKey as canonicalGroceryKeyCore,
  resolveCommonGroceryCategoryCore,
  resolveFromCategoryEntriesCore,
  tokensForFuzzyCacheLookup,
} from '../shared/groceryResolverCore';

const ALL_ZONE_KEYS: ZoneKey[] = [
  'produce',
  'bakery_deli',
  'meat_seafood',
  'dairy_eggs',
  'frozen',
  'pantry',
  'snacks_drinks',
  'household_cleaning',
  'personal_care',
  'other',
];

describe('grocery resolver parity and catalog invariants', () => {
  it('keeps bundled catalog zone_key values on the app ZoneKey union', () => {
    for (const row of COMMON_GROCERY_CATALOG) {
      expect(ALL_ZONE_KEYS).toContain(row.zone_key);
    }
  });

  it('exposes identical canonical keys from the app wrapper and edge core', () => {
    expect(canonicalGroceryKey('  2 lb   Organic  Bananas! ')).toBe(canonicalGroceryKeyCore('  2 lb   Organic  Bananas! '));
    expect(canonicalGroceryKey('dish soap')).toBe('dish soap');
  });

  it('matches catalog resolution between app wrapper and shared core', () => {
    const inputs = [
      'bananna',
      'organic bananas',
      '2 lb chicken breast',
      'dish soap',
      'salt',
      'pepper',
      'bell pepper',
      'garlic powder',
      'soy sauce',
    ];
    for (const input of inputs) {
      const a = resolveCommonGroceryCategory(input);
      const b = resolveCommonGroceryCategoryCore(input);
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(a!.zone_key).toBe(b!.zone_key);
      expect(a!.normalized_name).toBe(b!.normalized_name);
      expect(a!.category).toBe(b!.category);
      expect(a!.source).toBe(b!.source);
    }
  });

  it('applies exact cache key match before partial/fuzzy in resolveFromCategoryEntries', () => {
    const entries = [{ normalized_name: 'oat milk', zone_key: 'dairy_eggs' as ZoneKey, category: 'Dairy' }];
    const fromApp = resolveFromCategoryEntries('oat milk', entries);
    const fromCore = resolveFromCategoryEntriesCore('oat milk', entries);
    expect(fromApp?.source).toBe('cache_partial');
    expect(fromCore?.source).toBe('cache_partial');
    expect(fromApp?.confidence).toBe(0.96);
    expect(fromCore?.confidence).toBe(0.96);
  });

  it('collects deterministic fuzzy lookup tokens (length >= 3, capped)', () => {
    expect(tokensForFuzzyCacheLookup(['ab', 'x'])).toEqual([]);
    const t = tokensForFuzzyCacheLookup(['large banana', 'baby spinach'], 5);
    expect(t.length).toBeLessThanOrEqual(5);
    expect(new Set(t)).toEqual(new Set(['banana', 'baby', 'spinach']));
  });
});
