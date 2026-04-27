import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteAllListItems,
  deleteListItem,
  deleteListItemsInZone,
  insertListItems,
  toggleChecked,
  updateListItem,
} from '../services/listService';
import type { ListItemInsert, ListItemUpdate } from '../services/listService';
import { queryKeys } from '../query/keys';
import type { HomeListBundle } from '../query/homeListBundle';
import type { ListItem, ZoneKey } from '../types/models';

type MutationContext = { previous: HomeListBundle | undefined };

/**
 * List writes use onMutate for optimistic UI updates against the React Query
 * cache, then roll back on error via the captured snapshot. All mutations
 * require `userId` as an input so no async auth lookup is needed on the write
 * path. Consumers derive items from `listQuery.data` and never keep a shadow
 * copy in local state.
 */
export function useHomeListMutations() {
  const queryClient = useQueryClient();

  const writeCache = (
    userId: string,
    updater: (prev: HomeListBundle) => HomeListBundle
  ) => {
    queryClient.setQueryData<HomeListBundle>(
      queryKeys.homeList(userId),
      (prev) => (prev ? updater(prev) : prev)
    );
  };

  const cancelAndSnapshot = async (userId: string): Promise<MutationContext> => {
    await queryClient.cancelQueries({ queryKey: queryKeys.homeList(userId) });
    const previous = queryClient.getQueryData<HomeListBundle>(
      queryKeys.homeList(userId)
    );
    return { previous };
  };

  const rollback = (userId: string, ctx: MutationContext | undefined) => {
    if (ctx?.previous) {
      queryClient.setQueryData(queryKeys.homeList(userId), ctx.previous);
    }
  };

  const invalidateList = (userId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.homeList(userId) });
  };

  const insertItems = useMutation<
    ListItem[],
    unknown,
    { userId: string; items: ListItemInsert[] },
    MutationContext
  >({
    mutationFn: ({ userId, items }) => insertListItems(userId, items),
    onSuccess: (inserted, { userId }) => {
      if (inserted.length === 0) return;
      writeCache(userId, (prev) => ({
        ...prev,
        listItems: [...prev.listItems, ...inserted],
      }));
    },
    onError: (_e, { userId }) => invalidateList(userId),
  });

  const updateItem = useMutation<
    void,
    unknown,
    { userId: string; id: string; updates: ListItemUpdate },
    MutationContext
  >({
    mutationFn: ({ id, updates }) => updateListItem(id, updates),
    onMutate: async ({ userId, id, updates }) => {
      const ctx = await cancelAndSnapshot(userId);
      writeCache(userId, (prev) => ({
        ...prev,
        listItems: prev.listItems.map((i) =>
          i.id === id ? ({ ...i, ...updates } as ListItem) : i
        ),
      }));
      return ctx;
    },
    onError: (_e, { userId }, ctx) => rollback(userId, ctx),
    onSettled: (_d, _e, { userId }) => invalidateList(userId),
  });

  const toggleItem = useMutation<
    void,
    unknown,
    { userId: string; id: string; isChecked: boolean },
    MutationContext
  >({
    mutationFn: ({ id, isChecked }) => toggleChecked(id, isChecked),
    onMutate: async ({ userId, id, isChecked }) => {
      const ctx = await cancelAndSnapshot(userId);
      writeCache(userId, (prev) => ({
        ...prev,
        listItems: prev.listItems.map((i) =>
          i.id === id ? { ...i, is_checked: isChecked } : i
        ),
      }));
      return ctx;
    },
    onError: (_e, { userId }, ctx) => rollback(userId, ctx),
  });

  const removeItem = useMutation<
    void,
    unknown,
    { userId: string; id: string },
    MutationContext
  >({
    mutationFn: ({ id }) => deleteListItem(id),
    onMutate: async ({ userId, id }) => {
      const ctx = await cancelAndSnapshot(userId);
      writeCache(userId, (prev) => ({
        ...prev,
        listItems: prev.listItems.filter((i) => i.id !== id),
      }));
      return ctx;
    },
    onError: (_e, { userId }, ctx) => rollback(userId, ctx),
    onSettled: (_d, _e, { userId }) => invalidateList(userId),
  });

  const removeAllItems = useMutation<
    void,
    unknown,
    { userId: string },
    MutationContext
  >({
    mutationFn: ({ userId }) => deleteAllListItems(userId),
    onMutate: async ({ userId }) => {
      const ctx = await cancelAndSnapshot(userId);
      writeCache(userId, (prev) => ({ ...prev, listItems: [] }));
      return ctx;
    },
    onError: (_e, { userId }, ctx) => rollback(userId, ctx),
    onSettled: (_d, _e, { userId }) => invalidateList(userId),
  });

  const removeZoneItems = useMutation<
    void,
    unknown,
    { userId: string; zoneKey: ZoneKey },
    MutationContext
  >({
    mutationFn: ({ userId, zoneKey }) => deleteListItemsInZone(userId, zoneKey),
    onMutate: async ({ userId, zoneKey }) => {
      const ctx = await cancelAndSnapshot(userId);
      writeCache(userId, (prev) => ({
        ...prev,
        listItems: prev.listItems.filter((i) => i.zone_key !== zoneKey),
      }));
      return ctx;
    },
    onError: (_e, { userId }, ctx) => rollback(userId, ctx),
    onSettled: (_d, _e, { userId }) => invalidateList(userId),
  });

  return {
    insertItems,
    updateItem,
    toggleItem,
    removeItem,
    removeAllItems,
    removeZoneItems,
  };
}
