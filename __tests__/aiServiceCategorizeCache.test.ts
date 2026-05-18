/**
 * Tier 1 AI optimization: local categorization cache short-circuits the `categorize-items`
 * edge function. These tests verify:
 *   - All inputs cached locally -> zero network calls.
 *   - Partial cache coverage -> only uncached inputs are sent, network results merge back in
 *     the caller-visible order.
 *   - Network results are persisted to the local cache for future invocations.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { categorizeItems } from '../src/services/aiService';
import {
  __resetCategoryCacheForTests,
  hydrateCategoryCache,
  putCachedCategories,
  getCachedCategorySync,
} from '../src/services/aiCategoryCache';
import { supabase, isSyncEnabled } from '../src/services/supabaseClient';

jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'tok',
            expires_at: 9999999999,
            user: { id: 'user-1' },
          },
        },
        error: null,
      }),
      refreshSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'tok2', expires_at: 9999999999, user: { id: 'user-1' } } },
        error: null,
      }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
  isSupabaseConfigured: () => true,
  isSyncEnabled: jest.fn(() => true),
  isSupabaseSyncRequiredButMisconfigured: () => false,
  getUserId: jest.fn().mockResolvedValue('user-1'),
  signOutLocallyIfCorruptRefreshToken: jest.fn().mockResolvedValue(false),
  isCorruptSupabaseRefreshTokenError: jest.fn().mockReturnValue(false),
  LOCAL_USER_ID: 'local-user',
  getSupabaseProjectUrl: () => 'https://example.supabase.co',
  getSupabaseProjectRef: () => 'not-configured',
  parseJwtProjectRefFromAccessToken: () => null,
}));

const invokeMock = supabase.functions.invoke as jest.Mock;

describe('categorizeItems + local cache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetCategoryCacheForTests();
    await hydrateCategoryCache();
    invokeMock.mockReset();
    (isSyncEnabled as jest.Mock).mockReturnValue(true);
  });

  it('skips the network entirely when every input is a cache hit', async () => {
    await putCachedCategories([
      { normalized_name: 'milk', zone_key: 'dairy_eggs', category: 'Dairy' },
      { normalized_name: 'apples', zone_key: 'produce', category: 'Produce' },
    ]);

    const res = await categorizeItems(['Milk', 'apples'], 'generic', ['Produce', 'Dairy & Eggs']);

    expect(invokeMock).not.toHaveBeenCalled();
    expect(res.cache_hits).toBe(2);
    expect(res.cache_misses).toBe(0);
    expect(res.source_counts).toEqual({ cache_exact: 2 });
    expect(res.results).toEqual([
      expect.objectContaining({ input: 'Milk', zone_key: 'dairy_eggs', normalized_name: 'milk' }),
      expect.objectContaining({ input: 'apples', zone_key: 'produce', normalized_name: 'apples' }),
    ]);
  });

  it('only sends the uncached subset to the edge function and merges results by index', async () => {
    await putCachedCategories([
      { normalized_name: 'milk', zone_key: 'dairy_eggs', category: 'Dairy' },
    ]);

    invokeMock.mockImplementation((name: string, opts: { body: { items: string[] } }) => {
      expect(name).toBe('categorize-items');
      // Only the uncached names should be sent.
      expect(opts.body.items).toEqual(['Saffron', 'Miso Paste']);
      return Promise.resolve({
        data: {
          results: [
            { input: 'Saffron', normalized_name: 'saffron', category: 'Spices', zone_key: 'pantry', confidence: 0.94 },
            { input: 'Miso Paste', normalized_name: 'miso paste', category: 'Pantry', zone_key: 'pantry', confidence: 0.9 },
          ],
          cache_hits: 0,
          cache_misses: 2,
        },
        error: null,
      });
    });

    const res = await categorizeItems(['Saffron', 'Milk', 'Miso Paste'], 'generic', []);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer tok' },
    });
    expect(res.results).toEqual([
      expect.objectContaining({ zone_key: 'pantry', normalized_name: 'saffron' }),
      expect.objectContaining({ zone_key: 'dairy_eggs', normalized_name: 'milk' }),
      expect.objectContaining({ zone_key: 'pantry', normalized_name: 'miso paste' }),
    ]);
    expect(res.cache_hits).toBe(1);
    expect(res.cache_misses).toBe(2);
    expect(res.source_counts).toEqual({ cache_exact: 1 });
  });

  it('uses common and fuzzy local resolver before network calls', async () => {
    const res = await categorizeItems(['bananna', 'organic bananas', '2 lb chicken breast', 'dish soap'], 'generic', []);

    expect(invokeMock).not.toHaveBeenCalled();
    expect(res.results.map((r) => r.zone_key)).toEqual([
      'produce',
      'produce',
      'meat_seafood',
      'household_cleaning',
    ]);
    expect(res.results.map((r) => r.normalized_name)).toEqual([
      'bananna',
      'organic bananas',
      '2 lb chicken breast',
      'dish soap',
    ]);
    expect(res.fast_hits).toBe(4);
    expect(res.cache_misses).toBe(0);
    expect(res.source_counts).toEqual({
      catalog_fuzzy: 1,
      catalog_exact: 3,
    });
  });

  it('dedupes canonical unresolved inputs before calling the edge function', async () => {
    invokeMock.mockImplementation((name: string, opts: { body: { items: string[] } }) => {
      expect(name).toBe('categorize-items');
      expect(opts.body.items).toEqual(['Imported Licorice Root']);
      return Promise.resolve({
        data: {
          results: [
            {
              input: 'Imported Licorice Root',
              normalized_name: 'imported licorice root',
              category: 'Pantry',
              zone_key: 'pantry',
              confidence: 0.97,
            },
          ],
          cache_hits: 0,
          cache_misses: 1,
          source_counts: { openai: 1 },
        },
        error: null,
      });
    });

    const res = await categorizeItems(
      ['Imported Licorice Root', '2 oz imported licorice root'],
      'generic',
      []
    );

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(res.cache_misses).toBe(1);
    expect(res.results).toEqual([
      expect.objectContaining({
        input: 'Imported Licorice Root',
        normalized_name: 'imported licorice root',
      }),
      expect.objectContaining({
        input: '2 oz imported licorice root',
        normalized_name: '2 oz imported licorice root',
      }),
    ]);
    expect(res.source_counts).toEqual({ openai: 1 });
  });

  it('when sync is disabled, reports cache_misses for items that only the network could resolve', async () => {
    (isSyncEnabled as jest.Mock).mockReturnValue(false);
    try {
      const res = await categorizeItems(['milk', 'zz obscure uncached token xyz'], 'generic', []);
      expect(invokeMock).not.toHaveBeenCalled();
      expect(res.cache_hits).toBe(1);
      expect(res.cache_misses).toBe(1);
      expect(res.results[0].zone_key).toBe('dairy_eggs');
      expect(res.results[1].zone_key).toBe('other');
      expect(res.source_counts?.catalog_exact).toBe(1);
      expect(res.source_counts?.sync_disabled_uncached).toBe(1);
    } finally {
      (isSyncEnabled as jest.Mock).mockReturnValue(true);
    }
  });

  it('persists fresh network results into the local cache for next time', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        results: [
          {
            input: 'Imported Licorice Root',
            normalized_name: 'imported licorice root',
            category: 'Pantry',
            zone_key: 'pantry',
            confidence: 0.97,
          },
        ],
        cache_hits: 0,
        cache_misses: 1,
        source_counts: { openai: 1 },
      },
      error: null,
    });

    await categorizeItems(['Imported Licorice Root'], 'generic', []);

    // putCachedCategories is fire-and-forget — give the microtask queue a tick.
    await Promise.resolve();

    expect(getCachedCategorySync('Imported Licorice Root')).toMatchObject({
      zone_key: 'pantry',
      category: 'Pantry',
    });

    // Second call should hit the cache and skip the network.
    invokeMock.mockClear();
    const res = await categorizeItems(['Imported Licorice Root'], 'generic', []);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(res.results[0].zone_key).toBe('pantry');
  });
});
