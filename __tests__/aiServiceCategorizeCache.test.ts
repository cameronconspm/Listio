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
import { supabase } from '../src/services/supabaseClient';

jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'tok', expires_at: 9999999999 } },
        error: null,
      }),
      refreshSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'tok2' } },
        error: null,
      }),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
  isSupabaseConfigured: () => true,
  isSyncEnabled: () => true,
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
      expect(opts.body.items).toEqual(['Bananas', 'Chicken']);
      return Promise.resolve({
        data: {
          results: [
            { input: 'Bananas', normalized_name: 'bananas', category: 'Produce', zone_key: 'produce', confidence: 0.94 },
            { input: 'Chicken', normalized_name: 'chicken', category: 'Meat', zone_key: 'meat_seafood', confidence: 0.9 },
          ],
          cache_hits: 0,
          cache_misses: 2,
        },
        error: null,
      });
    });

    const res = await categorizeItems(['Bananas', 'Milk', 'Chicken'], 'generic', []);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(res.results).toEqual([
      expect.objectContaining({ zone_key: 'produce', normalized_name: 'bananas' }),
      expect.objectContaining({ zone_key: 'dairy_eggs', normalized_name: 'milk' }),
      expect.objectContaining({ zone_key: 'meat_seafood', normalized_name: 'chicken' }),
    ]);
    expect(res.cache_hits).toBe(1);
    expect(res.cache_misses).toBe(2);
  });

  it('persists fresh network results into the local cache for next time', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        results: [
          { input: 'Yogurt', normalized_name: 'yogurt', category: 'Dairy', zone_key: 'dairy_eggs', confidence: 0.97 },
        ],
        cache_hits: 0,
        cache_misses: 1,
      },
      error: null,
    });

    await categorizeItems(['Yogurt'], 'generic', []);

    // putCachedCategories is fire-and-forget — give the microtask queue a tick.
    await Promise.resolve();

    expect(getCachedCategorySync('yogurt')).toMatchObject({
      zone_key: 'dairy_eggs',
      category: 'Dairy',
    });

    // Second call should hit the cache and skip the network.
    invokeMock.mockClear();
    const res = await categorizeItems(['Yogurt'], 'generic', []);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(res.results[0].zone_key).toBe('dairy_eggs');
  });
});
