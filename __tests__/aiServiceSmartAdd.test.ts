/**
 * Focused tests for the merged Smart Add flow in `aiService.parseListItemsFromText`.
 *
 * While `aiServiceParseListItems.test.ts` covers the contract (shape, guards, error
 * wording), this file asserts the side effects we care about for the fast-path:
 *   - `smart-add` populates the local `aiCategoryCache` so the composer's optimistic
 *     insert path can use those zone/category answers synchronously.
 *   - No `parse-recipe` or `categorize-items` hop remains in the smart-add path.
 */

import { parseListItemsFromText } from '../src/services/aiService';
import { supabase } from '../src/services/supabaseClient';
import {
  __resetCategoryCacheForTests,
  getCachedCategorySync,
} from '../src/services/aiCategoryCache';

jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'tok' } },
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

const flushMicrotasks = async () => {
  for (let i = 0; i < 16; i++) {
    await Promise.resolve();
  }
};

describe('parseListItemsFromText — smart-add populates local cache', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    __resetCategoryCacheForTests();
  });

  it('stores each returned item in aiCategoryCache so single-item adds hit the fast path', async () => {
    invokeMock.mockResolvedValue({
      data: {
        items: [
          {
            name: 'Milk',
            normalized_name: 'milk',
            quantity: 1,
            unit: 'gal',
            zone_key: 'dairy_eggs',
            category: 'Dairy',
          },
          {
            name: 'Bananas',
            normalized_name: 'bananas',
            quantity: 6,
            unit: 'ea',
            zone_key: 'produce',
            category: 'Produce',
          },
        ],
      },
      error: null,
    });

    const rows = await parseListItemsFromText(
      'a gallon of milk, six bananas',
      'generic',
      ['Produce', 'Dairy & Eggs']
    );
    expect(rows).toHaveLength(2);

    // putCachedCategories is fire-and-forget; let its microtask queue drain.
    await flushMicrotasks();

    const milk = getCachedCategorySync('Milk');
    expect(milk).toMatchObject({
      normalized_name: 'milk',
      zone_key: 'dairy_eggs',
      category: 'Dairy',
    });

    const bananas = getCachedCategorySync('bananas');
    expect(bananas).toMatchObject({
      normalized_name: 'bananas',
      zone_key: 'produce',
      category: 'Produce',
    });
  });

  it('invokes a single edge function (smart-add) and never falls back to parse-recipe or categorize-items', async () => {
    invokeMock.mockResolvedValue({
      data: {
        items: [
          {
            name: 'Milk',
            normalized_name: 'milk',
            quantity: 1,
            unit: 'gal',
            zone_key: 'dairy_eggs',
            category: 'Dairy',
          },
        ],
      },
      error: null,
    });

    await parseListItemsFromText('milk', 'generic', []);

    const invokedNames = invokeMock.mock.calls.map((args) => args[0]);
    expect(invokedNames).toEqual(['smart-add']);
  });
});
