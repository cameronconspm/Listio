import { QueryClient } from '@tanstack/react-query';
import {
  mergeItemsIntoHomeListCache,
  type HomeListBundle,
} from '../src/query/homeListBundle';
import { queryKeys } from '../src/query/keys';
import type { ListItem } from '../src/types/models';

const userId = 'user-1';
const listId = 'list-1';

const seededItem: ListItem = {
  id: '00000000-0000-0000-0000-000000000002',
  user_id: userId,
  household_id: 'scope-1',
  list_id: listId,
  name: 'Bananas',
  normalized_name: 'bananas',
  category: '',
  zone_key: 'produce',
  quantity_value: null,
  quantity_unit: null,
  notes: null,
  is_checked: false,
  linked_meal_ids: [],
  brand_preference: null,
  substitute_allowed: true,
  priority: 'normal',
  is_recurring: false,
  created_at: '2026-07-04T00:00:00.000Z',
  updated_at: '2026-07-04T00:00:00.000Z',
};

const emptyBundle: HomeListBundle = {
  listItems: [],
  stores: [],
  store: null,
};

describe('mergeItemsIntoHomeListCache', () => {
  it('merges seeded items into a prefetched empty home bundle', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.homeList(userId, listId), emptyBundle);

    mergeItemsIntoHomeListCache(queryClient, userId, listId, [seededItem]);

    const bundle = queryClient.getQueryData<HomeListBundle>(
      queryKeys.homeList(userId, listId)
    );
    expect(bundle?.listItems).toHaveLength(1);
    expect(bundle?.listItems[0]?.name).toBe('Bananas');
  });

  it('creates a bundle when no cache entry exists yet', () => {
    const queryClient = new QueryClient();

    mergeItemsIntoHomeListCache(queryClient, userId, listId, [seededItem]);

    const bundle = queryClient.getQueryData<HomeListBundle>(
      queryKeys.homeList(userId, listId)
    );
    expect(bundle?.listItems).toHaveLength(1);
    expect(bundle?.stores).toEqual([]);
    expect(bundle?.store).toBeNull();
  });

  it('appends to existing list items without replacing them', () => {
    const queryClient = new QueryClient();
    const existing: ListItem = { ...seededItem, id: 'existing-id', name: 'Milk' };
    queryClient.setQueryData<HomeListBundle>(queryKeys.homeList(userId, listId), {
      listItems: [existing],
      stores: [],
      store: null,
    });

    mergeItemsIntoHomeListCache(queryClient, userId, listId, [seededItem]);

    const bundle = queryClient.getQueryData<HomeListBundle>(
      queryKeys.homeList(userId, listId)
    );
    expect(bundle?.listItems).toHaveLength(2);
    expect(bundle?.listItems.map((item) => item.name)).toEqual(['Milk', 'Bananas']);
  });

  it('no-ops when items array is empty', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.homeList(userId, listId), emptyBundle);

    mergeItemsIntoHomeListCache(queryClient, userId, listId, []);

    const bundle = queryClient.getQueryData<HomeListBundle>(
      queryKeys.homeList(userId, listId)
    );
    expect(bundle?.listItems).toEqual([]);
  });
});
