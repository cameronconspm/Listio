/**
 * Unit tests for the local AI categorization cache. Verifies:
 *   - hydrate + sync lookup miss/hit
 *   - put writes through to AsyncStorage and surfaces on next lookup
 *   - TTL expiry drops stale entries and lazily evicts
 *   - MAX_ENTRIES LRU eviction preserves most-recently-written rows
 *   - clear wipes both memory and storage
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  __resetCategoryCacheForTests,
  clearCategoryCache,
  getCachedCategorySync,
  hydrateCategoryCache,
  putCachedCategories,
} from '../src/services/aiCategoryCache';

const STORAGE_KEY = '@listio/ai_category_cache_v1';

async function flushPersist(): Promise<void> {
  // Cache persists on a 250ms debounce; advance real time briefly so the setTimeout
  // callback resolves before we assert on AsyncStorage contents.
  await new Promise((r) => setTimeout(r, 400));
}

describe('aiCategoryCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetCategoryCacheForTests();
  });

  it('returns null on miss before any puts', async () => {
    await hydrateCategoryCache();
    expect(getCachedCategorySync('milk')).toBeNull();
  });

  it('persists writes and surfaces them on subsequent hydrate', async () => {
    await hydrateCategoryCache();
    await putCachedCategories([
      { normalized_name: 'milk', zone_key: 'dairy_eggs', category: 'Dairy' },
    ]);
    expect(getCachedCategorySync('Milk')).toMatchObject({
      normalized_name: 'milk',
      zone_key: 'dairy_eggs',
      category: 'Dairy',
    });

    await flushPersist();

    // Fresh module state: simulate a cold start.
    __resetCategoryCacheForTests();
    await hydrateCategoryCache();
    expect(getCachedCategorySync('milk')).toMatchObject({ zone_key: 'dairy_eggs' });
  });

  it('drops entries older than TTL and lazily evicts them', async () => {
    await hydrateCategoryCache();
    await putCachedCategories([
      { normalized_name: 'milk', zone_key: 'dairy_eggs', category: 'Dairy' },
    ]);
    await flushPersist();

    // Rewrite storage with a stale cached_at so the next hydrate skips it.
    const staleAt = Date.now() - 60 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        entries: [
          {
            normalized_name: 'milk',
            zone_key: 'dairy_eggs',
            category: 'Dairy',
            cached_at: staleAt,
          },
        ],
      })
    );

    __resetCategoryCacheForTests();
    await hydrateCategoryCache();
    expect(getCachedCategorySync('milk')).toBeNull();
  });

  it('caps at MAX_ENTRIES and evicts oldest writes first (LRU)', async () => {
    await hydrateCategoryCache();

    const entries = Array.from({ length: 520 }, (_, i) => ({
      normalized_name: `item_${i}`,
      zone_key: 'pantry' as const,
      category: 'Pantry',
    }));
    await putCachedCategories(entries);

    // With MAX_ENTRIES = 500, the first ~20 writes should have been evicted.
    expect(getCachedCategorySync('item_0')).toBeNull();
    expect(getCachedCategorySync('item_5')).toBeNull();
    // The most recent writes survive.
    expect(getCachedCategorySync('item_519')).toMatchObject({
      normalized_name: 'item_519',
    });
    expect(getCachedCategorySync('item_500')).toMatchObject({
      normalized_name: 'item_500',
    });
  });

  it('clearCategoryCache wipes memory and storage', async () => {
    await hydrateCategoryCache();
    await putCachedCategories([
      { normalized_name: 'milk', zone_key: 'dairy_eggs', category: 'Dairy' },
    ]);
    await flushPersist();

    await clearCategoryCache();
    expect(getCachedCategorySync('milk')).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('normalizes keys case-insensitively and by whitespace', async () => {
    await hydrateCategoryCache();
    await putCachedCategories([
      { normalized_name: 'chicken breasts', zone_key: 'meat_seafood', category: 'Meat' },
    ]);

    expect(getCachedCategorySync('CHICKEN   BREASTS')).toMatchObject({
      zone_key: 'meat_seafood',
    });
    expect(getCachedCategorySync('  Chicken Breasts ')).toMatchObject({
      zone_key: 'meat_seafood',
    });
  });
});
