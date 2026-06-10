/* eslint-disable import/first -- jest.mock is hoisted; keep mock adjacent to imports for readability */
jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
  isSyncEnabled: jest.fn(() => true),
  isSupabaseConfigured: () => true,
  isSupabaseSyncRequiredButMisconfigured: () => false,
  getUserId: jest.fn(),
  getSupabaseProjectUrl: () => 'https://example.supabase.co',
  getSupabaseProjectRef: () => 'not-configured',
  parseJwtProjectRefFromAccessToken: () => null,
  signOutLocallyIfCorruptRefreshToken: jest.fn().mockResolvedValue(false),
  isCorruptSupabaseRefreshTokenError: jest.fn().mockReturnValue(false),
  LOCAL_USER_ID: 'local-user',
}));

jest.mock('../src/services/engagementPaywallTriggers', () => ({
  notifyMeaningfulListOrRecipeAction: jest.fn(),
}));

jest.mock('../src/services/notifyFreeTierNearLimit', () => ({
  notifyFreeTierNearLimitIfNeeded: jest.fn(),
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as listService from '../src/services/listService';
import { useHomeListMutations } from '../src/hooks/useHomeListMutations';
import { queryKeys } from '../src/query/keys';
import type { HomeListBundle } from '../src/query/homeListBundle';
import type { ListItem } from '../src/types/models';
import { isPendingListItemId } from '../src/utils/listItemPending';

const existing: ListItem = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: 'u1',
  household_id: 'scope-1',
  list_id: 'list-1',
  name: 'Milk',
  normalized_name: 'milk',
  category: 'Dairy',
  zone_key: 'dairy_eggs',
  quantity_value: null,
  quantity_unit: null,
  notes: null,
  is_checked: false,
  linked_meal_ids: [],
  brand_preference: null,
  substitute_allowed: true,
  priority: 'normal',
  is_recurring: false,
  created_at: '2020-01-01T00:00:00.000Z',
  updated_at: '2020-01-01T00:00:00.000Z',
};

const serverInserted: ListItem = {
  id: '22222222-2222-2222-2222-222222222222',
  user_id: 'u1',
  household_id: 'scope-1',
  list_id: 'list-1',
  name: 'Eggs',
  normalized_name: 'eggs',
  category: 'Dairy',
  zone_key: 'dairy_eggs',
  quantity_value: null,
  quantity_unit: null,
  notes: null,
  is_checked: false,
  linked_meal_ids: [],
  brand_preference: null,
  substitute_allowed: true,
  priority: 'normal',
  is_recurring: false,
  created_at: '2020-01-02T00:00:00.000Z',
  updated_at: '2020-01-02T00:00:00.000Z',
};

describe('useHomeListMutations insertItems optimistic', () => {
  const insertSpy = jest.spyOn(listService, 'insertListItems');

  afterEach(() => {
    insertSpy.mockReset();
  });

  afterAll(() => {
    insertSpy.mockRestore();
  });

  it('appends pending rows immediately then replaces them with server rows on success', async () => {
    let finishInsert!: (rows: ListItem[]) => void;
    insertSpy.mockImplementationOnce(
      () =>
        new Promise<ListItem[]>((resolve) => {
          finishInsert = resolve;
        })
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const initialBundle: HomeListBundle = {
      listItems: [existing],
      stores: [],
      store: null,
    };
    queryClient.setQueryData(queryKeys.homeList('u1'), initialBundle);

    const apiRef: { current: ReturnType<typeof useHomeListMutations> | null } = { current: null };

    function Harness() {
      const api = useHomeListMutations();
      apiRef.current = api;
      return null;
    }

    await act(async () => {
      TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      );
    });

    const insertItems = apiRef.current!.insertItems;

    await act(async () => {
      insertItems.mutate({
        userId: 'u1',
        items: [
          {
            user_id: 'u1',
            name: 'Eggs',
            normalized_name: 'eggs',
            category: 'Dairy',
            zone_key: 'dairy_eggs',
            quantity_value: null,
            quantity_unit: null,
            notes: null,
            is_checked: false,
            linked_meal_ids: [],
          },
        ],
      });
      await Promise.resolve();
    });

    const mid = queryClient.getQueryData<HomeListBundle>(queryKeys.homeList('u1'));
    expect(mid?.listItems.length).toBe(2);
    const pending = mid!.listItems.find((i) => i.name === 'Eggs');
    expect(pending).toBeDefined();
    expect(isPendingListItemId(pending!.id)).toBe(true);

    await act(async () => {
      finishInsert([serverInserted]);
      await Promise.resolve();
      await Promise.resolve();
    });

    const final = queryClient.getQueryData<HomeListBundle>(queryKeys.homeList('u1'));
    expect(final?.listItems.map((i) => i.id)).toEqual([existing.id, serverInserted.id]);
    expect(final?.listItems.every((i) => !isPendingListItemId(i.id))).toBe(true);
  });

  it('invokes onOptimisticApplied after the optimistic cache write', async () => {
    let finishInsert!: (rows: ListItem[]) => void;
    insertSpy.mockImplementationOnce(
      () =>
        new Promise<ListItem[]>((resolve) => {
          finishInsert = resolve;
        })
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const initialBundle: HomeListBundle = {
      listItems: [existing],
      stores: [],
      store: null,
    };
    queryClient.setQueryData(queryKeys.homeList('u1'), initialBundle);

    const apiRef: { current: ReturnType<typeof useHomeListMutations> | null } = { current: null };

    function Harness() {
      const api = useHomeListMutations();
      apiRef.current = api;
      return null;
    }

    await act(async () => {
      TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      );
    });

    const insertItems = apiRef.current!.insertItems;
    const onOptimisticApplied = jest.fn();

    await act(async () => {
      insertItems.mutate({
        userId: 'u1',
        items: [
          {
            user_id: 'u1',
            name: 'Eggs',
            normalized_name: 'eggs',
            category: 'Dairy',
            zone_key: 'dairy_eggs',
            quantity_value: null,
            quantity_unit: null,
            notes: null,
            is_checked: false,
            linked_meal_ids: [],
          },
        ],
        onOptimisticApplied,
      });
      await Promise.resolve();
    });

    expect(onOptimisticApplied).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishInsert([serverInserted]);
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('rolls back to the previous bundle when insertListItems rejects', async () => {
    insertSpy.mockRejectedValueOnce(new Error('network'));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const initialBundle: HomeListBundle = {
      listItems: [existing],
      stores: [],
      store: null,
    };
    queryClient.setQueryData(queryKeys.homeList('u1'), initialBundle);

    const apiRef: { current: ReturnType<typeof useHomeListMutations> | null } = { current: null };

    function Harness() {
      const api = useHomeListMutations();
      apiRef.current = api;
      return null;
    }

    await act(async () => {
      TestRenderer.create(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      );
    });

    const insertItems = apiRef.current!.insertItems;

    await expect(
      act(async () => {
        await insertItems.mutateAsync({
          userId: 'u1',
          items: [
            {
              user_id: 'u1',
              name: 'Eggs',
              normalized_name: 'eggs',
              category: 'Dairy',
              zone_key: 'dairy_eggs',
              quantity_value: null,
              quantity_unit: null,
              notes: null,
              is_checked: false,
              linked_meal_ids: [],
            },
          ],
        });
      })
    ).rejects.toThrow('network');

    const after = queryClient.getQueryData<HomeListBundle>(queryKeys.homeList('u1'));
    expect(after?.listItems).toEqual([existing]);
  });
});
