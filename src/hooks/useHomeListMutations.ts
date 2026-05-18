import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteAllListItems,
  deleteCheckedListItems,
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
import { newPendingListItemId } from '../utils/listItemPending';
import { notifyMeaningfulListOrRecipeAction } from '../services/engagementPaywallTriggers';

type MutationContext = { previous: HomeListBundle | undefined };

type InsertMutationContext = MutationContext & { optimisticIds: string[] };

/** Variables for `insertItems.mutate`; `onOptimisticApplied` is not sent to the API. */
export type InsertListItemsVariables = {
  userId: string;
  items: ListItemInsert[];
  onOptimisticApplied?: () => void;
};

function listItemFromInsert(insert: ListItemInsert, id: string, householdId?: string): ListItem {
  const ts = new Date().toISOString();
  return {
    id,
    user_id: insert.user_id,
    ...(householdId ? { household_id: householdId } : {}),
    name: insert.name,
    normalized_name: insert.normalized_name,
    category: insert.category,
    zone_key: insert.zone_key,
    quantity_value: insert.quantity_value,
    quantity_unit: insert.quantity_unit,
    notes: insert.notes,
    is_checked: insert.is_checked,
    linked_meal_ids: insert.linked_meal_ids,
    brand_preference: insert.brand_preference ?? null,
    substitute_allowed: insert.substitute_allowed ?? true,
    priority: insert.priority ?? 'normal',
    is_recurring: insert.is_recurring ?? false,
    created_at: ts,
    updated_at: ts,
  };
}

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
    InsertListItemsVariables,
    InsertMutationContext
  >({
    mutationFn: ({ userId, items }) => insertListItems(userId, items),
    onMutate: async (variables) => {
      const { userId, items, onOptimisticApplied } = variables;
      const ctx = await cancelAndSnapshot(userId);
      const optimisticIds: string[] = [];
      if (!ctx.previous || items.length === 0) {
        return { ...ctx, optimisticIds };
      }
      const householdId = ctx.previous.listItems.find((i) => i.household_id)?.household_id;
      const optimisticRows: ListItem[] = items.map((ins) => {
        const id = newPendingListItemId();
        optimisticIds.push(id);
        return listItemFromInsert(ins, id, householdId);
      });
      writeCache(userId, (prev) => {
        if (!prev) return prev;
        return { ...prev, listItems: [...prev.listItems, ...optimisticRows] };
      });
      onOptimisticApplied?.();
      return { previous: ctx.previous, optimisticIds };
    },
    onSuccess: (inserted, { userId, items }, ctx) => {
      if (inserted.length === 0) return;
      notifyMeaningfulListOrRecipeAction();
      const optimisticIds = ctx?.optimisticIds ?? [];
      if (optimisticIds.length === 0) {
        writeCache(userId, (prev) =>
          prev ? { ...prev, listItems: [...prev.listItems, ...inserted] } : prev
        );
        return;
      }
      if (inserted.length !== items.length || optimisticIds.length !== items.length) {
        invalidateList(userId);
        return;
      }
      const pendingSet = new Set(optimisticIds);
      writeCache(userId, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          listItems: [...prev.listItems.filter((i) => !pendingSet.has(i.id)), ...inserted],
        };
      });
    },
    onError: (_e, { userId }, ctx) => {
      rollback(userId, ctx);
      invalidateList(userId);
    },
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

  const removeCheckedItems = useMutation<
    void,
    unknown,
    { userId: string },
    MutationContext
  >({
    mutationFn: ({ userId }) => deleteCheckedListItems(userId),
    onMutate: async ({ userId }) => {
      const ctx = await cancelAndSnapshot(userId);
      writeCache(userId, (prev) => ({
        ...prev,
        listItems: prev.listItems.filter((i) => !i.is_checked),
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
    removeCheckedItems,
  };
}
