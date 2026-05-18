/**
 * Unit tests for `parseListItemsFromText` — the Smart Add merged `smart-add` edge
 * function flow (parse + categorize in one hop). Mocks the underlying Supabase client
 * so tests are hermetic and don't hit the network.
 */

import { FunctionsHttpError } from '@supabase/supabase-js';
import { parseListItemsFromText } from '../src/services/aiService';
import { supabase } from '../src/services/supabaseClient';
import { __resetCategoryCacheForTests } from '../src/services/aiCategoryCache';
import { invalidateEdgeInvocationAuthCache } from '../src/services/edgeInvocationAuth';

jest.mock('../src/services/subscriptionEntitlementSyncService', () => ({
  ensureServerSubscriptionMirror: jest.fn().mockResolvedValue({ synced: true, isActive: true }),
  syncSubscriptionEntitlementToServer: jest.fn().mockResolvedValue({ synced: true, isActive: true }),
}));

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
        data: {
          session: { access_token: 'tok2', expires_at: 9999999999, user: { id: 'user-1' } },
        },
        error: null,
      }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
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

describe('parseListItemsFromText (smart-add)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    __resetCategoryCacheForTests();
    invalidateEdgeInvocationAuthCache();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'tok',
          expires_at: 9999999999,
          user: { id: 'user-1' },
        },
      },
      error: null,
    });
    (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
      data: {
        session: { access_token: 'tok2', expires_at: 9999999999, user: { id: 'user-1' } },
      },
      error: null,
    });
  });

  it('invokes only the smart-add edge function and returns ParsedListItem[]', async () => {
    invokeMock.mockImplementation((name: string) => {
      if (name === 'smart-add') {
        return Promise.resolve({
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
                name: 'Chicken breasts',
                normalized_name: 'chicken breasts',
                quantity: 2,
                unit: 'lb',
                zone_key: 'meat_seafood',
                category: 'Meat',
              },
              {
                name: 'Avocados',
                normalized_name: 'avocados',
                quantity: 3,
                unit: 'ea',
                zone_key: 'produce',
                category: 'Produce',
              },
            ],
          },
          error: null,
        });
      }
      return Promise.reject(new Error(`Unexpected invoke ${name}`));
    });

    const rows = await parseListItemsFromText(
      'a gallon of milk, two pounds of chicken breasts, three avocados',
      'generic',
      ['Produce', 'Dairy & Eggs']
    );

    expect(rows).toEqual([
      { name: 'Milk', normalized_name: 'milk', quantity: 1, unit: 'gal', zone_key: 'dairy_eggs', category: 'Dairy' },
      {
        name: 'Chicken breasts',
        normalized_name: 'chicken breasts',
        quantity: 2,
        unit: 'lb',
        zone_key: 'meat_seafood',
        category: 'Meat',
      },
      {
        name: 'Avocados',
        normalized_name: 'avocados',
        quantity: 3,
        unit: 'ea',
        zone_key: 'produce',
        category: 'Produce',
      },
    ]);

    // Only one edge function call total — no more parse-recipe + categorize-items chain.
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('smart-add', expect.any(Object));
    expect(invokeMock).not.toHaveBeenCalledWith('parse-recipe', expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith('categorize-items', expect.anything());
  });

  it('retries smart-add once after 401 by refreshing session and invalidating edge JWT cache', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'JWT expired' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
    const unauthorizedErr = new FunctionsHttpError(unauthorizedResponse);
    const successPayload = {
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
    };

    const getSessionMock = supabase.auth.getSession as jest.Mock;
    const refreshSessionMock = supabase.auth.refreshSession as jest.Mock;
    refreshSessionMock.mockImplementationOnce(async () => {
      getSessionMock.mockResolvedValue({
        data: {
          session: {
            access_token: 'tok2',
            expires_at: 9999999999,
            user: { id: 'user-1' },
          },
        },
        error: null,
      });
      return {
        data: {
          session: { access_token: 'tok2', expires_at: 9999999999, user: { id: 'user-1' } },
        },
        error: null,
      };
    });

    invokeMock
      .mockResolvedValueOnce({ data: null, error: unauthorizedErr })
      .mockResolvedValueOnce(successPayload);

    const rows = await parseListItemsFromText('milk', 'generic', []);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Milk');
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock).toHaveBeenNthCalledWith(
      2,
      'smart-add',
      expect.objectContaining({
        headers: { Authorization: 'Bearer tok2' },
      })
    );
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
  });

  it('forwards storeType and zoneLabelsInOrder in the body', async () => {
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

    await parseListItemsFromText('milk', 'kroger', ['Produce', 'Dairy & Eggs']);

    expect(invokeMock).toHaveBeenCalledWith(
      'smart-add',
      expect.objectContaining({
        body: {
          text: 'milk',
          storeType: 'kroger',
          zoneLabelsInOrder: ['Produce', 'Dairy & Eggs'],
        },
        headers: { Authorization: 'Bearer tok' },
      })
    );
  });

  it('throws a user-friendly error when smart-add returns zero items', async () => {
    invokeMock.mockResolvedValue({ data: { items: [] }, error: null });

    await expect(parseListItemsFromText('asdfasdf', 'generic', [])).rejects.toThrow(
      /Didn't catch any items/
    );
  });

  it('enforces empty-input guard before hitting the network', async () => {
    await expect(parseListItemsFromText('   ', 'generic', [])).rejects.toThrow(
      /Describe what you need/
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('enforces max input length', async () => {
    const longText = 'a'.repeat(20000);
    await expect(parseListItemsFromText(longText, 'generic', [])).rejects.toThrow(/too long/);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('surfaces a Smart-add-phrased error when the edge function fails', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('backend down') });

    // Non-FunctionsHttpError falls through to the raw message; the composer caller
    // presents it verbatim. Either way, the wording never mentions "recipe".
    await expect(parseListItemsFromText('milk', 'generic', [])).rejects.not.toThrow(/recipe/i);
  });

  it('falls back to parse-recipe + categorize-items when smart-add returns 404 (not deployed)', async () => {
    // Simulate the Supabase 404 shape: FunctionsHttpError carries the raw Response on `context`.
    const notFoundResponse = new Response(
      JSON.stringify({ error: 'Requested function was not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
    const notFoundErr = new FunctionsHttpError(notFoundResponse);

    invokeMock.mockImplementation((name: string) => {
      if (name === 'smart-add') {
        return Promise.resolve({ data: null, error: notFoundErr });
      }
      if (name === 'parse-recipe') {
        return Promise.resolve({
          data: {
            recipe: {
              ingredients: [
                { name: 'Milk', quantity_value: 1, quantity_unit: 'gal', notes: null },
              ],
            },
            cache_hit: false,
          },
          error: null,
        });
      }
      if (name === 'categorize-items') {
        return Promise.resolve({
          data: {
            results: [
              {
                input: 'Milk',
                normalized_name: 'milk',
                category: 'Dairy',
                zone_key: 'dairy_eggs',
                confidence: 0.9,
              },
            ],
            cache_hits: 0,
            cache_misses: 1,
          },
          error: null,
        });
      }
      return Promise.reject(new Error(`Unexpected invoke ${name}`));
    });

    // The caller is unaware of which backend path served the result; the shape is identical.
    const rows = await parseListItemsFromText('milk', 'generic', []);
    expect(rows).toEqual([
      {
        name: 'Milk',
        normalized_name: 'milk',
        quantity: 1,
        unit: 'gal',
        zone_key: 'dairy_eggs',
        category: 'Dairy',
      },
    ]);

    const invokedNames = invokeMock.mock.calls.map((args) => args[0]);
    // `categorize-items` is skipped when names resolve entirely via the local fast path.
    expect(invokedNames).toEqual(['smart-add', 'parse-recipe']);
  });

  it('defaults missing fields to safe values', async () => {
    invokeMock.mockResolvedValue({
      data: {
        items: [
          { name: 'Bread' },
          { name: 'Bananas', quantity: 0, unit: '' },
        ],
      },
      error: null,
    });

    const rows = await parseListItemsFromText('bread, bananas', 'generic', []);
    expect(rows).toEqual([
      {
        name: 'Bread',
        normalized_name: 'bread',
        quantity: 1,
        unit: 'ea',
        zone_key: 'other',
        category: 'other',
      },
      {
        name: 'Bananas',
        normalized_name: 'bananas',
        quantity: 1,
        unit: 'ea',
        zone_key: 'other',
        category: 'other',
      },
    ]);
  });
});
