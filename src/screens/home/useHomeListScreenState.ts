import React, { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, useIsRestoring, keepPreviousData } from '@tanstack/react-query';
import {
  deriveHomeListModel,
  shareHomeListDerivedModel,
  safeZoneOrderOrDefault,
} from './homeScreenListDerived';
import { fetchHomeListBundle, HOME_LIST_STALE_MS } from '../../query/homeListBundle';
import { queryKeys } from '../../query/keys';
import { prefetchRecipesAndDefaultMealsRange } from '../../query/prefetchAdjacentTabs';
import { useHomeListMutations } from '../../hooks/useHomeListMutations';
import { getMealsByIds } from '../../services/mealService';
import { linkedMealRowMeta, type LinkedMealRowMeta } from '../../utils/mealLabel';
import { seedCategoryCacheFromListItems } from '../../services/aiCategoryCache';
import { notifyListItemsForMilestones } from '../../firstLaunchTour/milestoneUnlockFlow';
import { time } from '../../utils/perf';
import type { ListItem, StoreProfile, ZoneKey } from '../../types/models';

const EMPTY_ITEMS: ListItem[] = [];

export type UseHomeListScreenStateParams = {
  userId: string | null | undefined;
  shoppingMode: 'plan' | 'shop';
  filterZone: ZoneKey | 'all';
  zoneOrder: ZoneKey[];
  sessionZoneOrder: ZoneKey[] | null;
  setLinkedMealLabels: React.Dispatch<React.SetStateAction<Map<string, LinkedMealRowMeta>>>;
};

/**
 * List query, mutations, derived sections, and linked-meal labels for `HomeScreen`.
 */
export function useHomeListScreenState({
  userId,
  shoppingMode,
  filterZone,
  zoneOrder,
  sessionZoneOrder,
  setLinkedMealLabels,
}: UseHomeListScreenStateParams) {
  const queryClient = useQueryClient();
  const isRestoringCache = useIsRestoring();
  const previousDerivedRef = useRef<ReturnType<typeof deriveHomeListModel> | null>(null);
  const prefetchedForUserRef = useRef<string | null>(null);

  const listQuery = useQuery({
    queryKey: queryKeys.homeList(userId ?? ''),
    queryFn: () => fetchHomeListBundle(userId!, queryClient),
    enabled: typeof userId === 'string' && userId.length > 0,
    staleTime: HOME_LIST_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const userReady = typeof userId === 'string' && userId.length > 0;
  const listAwaitingFirstPayload =
    userReady && listQuery.data === undefined && (listQuery.isPending || isRestoringCache);
  const listBlocking = userId === undefined || listAwaitingFirstPayload;

  useEffect(() => {
    if (typeof userId !== 'string' || !userId || !listQuery.isSuccess) return;
    if (prefetchedForUserRef.current === userId) return;
    prefetchedForUserRef.current = userId;
    prefetchRecipesAndDefaultMealsRange(userId, queryClient);
  }, [userId, listQuery.isSuccess, queryClient]);

  const mutations = useHomeListMutations();

  const items = (listQuery.data?.listItems ?? EMPTY_ITEMS) as ListItem[];
  const store: StoreProfile | null = listQuery.data?.store ?? null;

  const categorySeedSignature = useMemo(
    () =>
      items
        .map((item) => `${item.normalized_name}|${item.zone_key}|${item.category}`)
        .join('\n'),
    [items]
  );

  useEffect(() => {
    if (!categorySeedSignature) return;
    const id = setTimeout(() => {
      seedCategoryCacheFromListItems(
        items.map((item) => ({
          normalized_name: item.normalized_name,
          zone_key: item.zone_key,
          category: item.category,
        }))
      );
    }, 400);
    return () => clearTimeout(id);
  }, [categorySeedSignature, items]);

  const linkedMealIdsSignature = useMemo(() => {
    const listData = listQuery.data?.listItems;
    if (!listData) return '';
    const ids = new Set<string>();
    for (const i of listData) {
      const linked = i.linked_meal_ids;
      if (!linked) continue;
      for (const id of linked) ids.add(id);
    }
    if (ids.size === 0) return '';
    return Array.from(ids).sort().join(',');
  }, [listQuery.data?.listItems]);

  useEffect(() => {
    if (!linkedMealIdsSignature) {
      setLinkedMealLabels((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    const mealIds = linkedMealIdsSignature.split(',');
    let cancelled = false;
    void getMealsByIds(mealIds).then((meals) => {
      if (cancelled) return;
      const map = new Map<string, LinkedMealRowMeta>();
      for (const m of meals) {
        map.set(m.id, linkedMealRowMeta(m));
      }
      setLinkedMealLabels(map);
    });
    return () => {
      cancelled = true;
    };
  }, [linkedMealIdsSignature, setLinkedMealLabels]);

  const safeZoneOrder = useMemo(() => safeZoneOrderOrDefault(zoneOrder), [zoneOrder]);
  const effectiveZoneOrder = useMemo(
    () => sessionZoneOrder ?? safeZoneOrder,
    [sessionZoneOrder, safeZoneOrder]
  );

  const derived = useMemo(() => {
    const next = time('deriveHomeListModel', () =>
      deriveHomeListModel(items, effectiveZoneOrder, shoppingMode, filterZone)
    );
    const shared = shareHomeListDerivedModel(previousDerivedRef.current, next);
    previousDerivedRef.current = shared;
    return shared;
  }, [items, effectiveZoneOrder, shoppingMode, filterZone]);

  useEffect(() => {
    notifyListItemsForMilestones(items);
  }, [items]);

  return {
    listQuery,
    queryClient,
    userReady,
    listBlocking,
    listAwaitingFirstPayload,
    items,
    store,
    effectiveZoneOrder,
    safeZoneOrder,
    sections: derived.sections,
    derived,
    ...mutations,
  };
}
