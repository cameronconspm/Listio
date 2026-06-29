import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, useIsRestoring } from '@tanstack/react-query';
import {
  applyHomeListView,
  deriveHomeListCore,
  shareHomeListDerivedModel,
  safeZoneOrderOrDefault,
  type HomeListDerivedModel,
} from './homeScreenListDerived';
import { fetchHomeListBundle, HOME_LIST_STALE_MS } from '../../query/homeListBundle';
import {
  fetchLinkedMealLabelsBundle,
  labelsMapFromBundle,
} from '../../query/linkedMealLabelsBundle';
import { queryKeys } from '../../query/keys';
import { prefetchRecipesAndDefaultMealsRange } from '../../query/prefetchAdjacentTabs';
import { useHomeListMutations } from '../../hooks/useHomeListMutations';
import { seedCategoryCacheFromListItems } from '../../services/aiCategoryCache';
import { notifyListItemsForMilestones } from '../../firstLaunchTour/milestoneUnlockFlow';
import { time } from '../../utils/perf';
import type { ListItem, StoreProfile, ZoneKey } from '../../types/models';

const EMPTY_ITEMS: ListItem[] = [];

export type UseHomeListScreenStateParams = {
  userId: string | null | undefined;
  /** Active shopping list id — included in the React Query cache key for instant switches. */
  activeListId: string | null;
  shoppingMode: 'plan' | 'shop';
  filterZone: ZoneKey | 'all';
  zoneOrder: ZoneKey[];
  sessionZoneOrder: ZoneKey[] | null;
};

/**
 * List query, mutations, derived sections, and linked-meal labels for `HomeScreen`.
 */
export function useHomeListScreenState({
  userId,
  activeListId,
  shoppingMode,
  filterZone,
  zoneOrder,
  sessionZoneOrder,
}: UseHomeListScreenStateParams) {
  const queryClient = useQueryClient();
  const isRestoringCache = useIsRestoring();
  const previousDerivedRef = useRef<HomeListDerivedModel | null>(null);
  const prefetchedForUserRef = useRef<string | null>(null);

  const listQueryKey =
    typeof userId === 'string' && userId.length > 0 && activeListId
      ? queryKeys.homeList(userId, activeListId)
      : null;

  const listQuery = useQuery({
    queryKey: listQueryKey ?? queryKeys.homeList('', 'pending'),
    queryFn: () => fetchHomeListBundle(userId!, queryClient, activeListId!),
    enabled: listQueryKey != null,
    staleTime: HOME_LIST_STALE_MS,
  });

  const mutations = useHomeListMutations(activeListId);

  const userReady = typeof userId === 'string' && userId.length > 0;
  const listAwaitingFirstPayload =
    userReady &&
    activeListId != null &&
    listQuery.data === undefined &&
    (listQuery.isPending || isRestoringCache);
  const listBlocking = userId === undefined || activeListId == null || listAwaitingFirstPayload;

  useEffect(() => {
    if (typeof userId !== 'string' || !userId || !listQuery.isSuccess) return;
    if (prefetchedForUserRef.current === userId) return;
    prefetchedForUserRef.current = userId;
    prefetchRecipesAndDefaultMealsRange(userId, queryClient);
  }, [userId, listQuery.isSuccess, queryClient]);

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

  const linkedMealLabelsQueryKey =
    typeof userId === 'string' &&
    userId.length > 0 &&
    activeListId &&
    linkedMealIdsSignature.length > 0
      ? queryKeys.linkedMealLabels(userId, activeListId, linkedMealIdsSignature)
      : null;

  const linkedMealLabelsQuery = useQuery({
    queryKey: linkedMealLabelsQueryKey ?? queryKeys.linkedMealLabels('', 'pending', ''),
    queryFn: () => fetchLinkedMealLabelsBundle(linkedMealIdsSignature.split(',')),
    enabled: linkedMealLabelsQueryKey != null,
    staleTime: HOME_LIST_STALE_MS,
  });

  const linkedMealLabels = useMemo(
    () => labelsMapFromBundle(linkedMealLabelsQuery.data),
    [linkedMealLabelsQuery.data]
  );

  const safeZoneOrder = useMemo(() => safeZoneOrderOrDefault(zoneOrder), [zoneOrder]);
  const effectiveZoneOrder = useMemo(
    () => sessionZoneOrder ?? safeZoneOrder,
    [sessionZoneOrder, safeZoneOrder]
  );

  const coreDerived = useMemo(
    () =>
      time('deriveHomeListCore', () =>
        deriveHomeListCore(items, effectiveZoneOrder, filterZone)
      ),
    [items, effectiveZoneOrder, filterZone]
  );

  const derived = useMemo(() => {
    const next = applyHomeListView(coreDerived, shoppingMode);
    const shared = shareHomeListDerivedModel(previousDerivedRef.current, next);
    previousDerivedRef.current = shared;
    return shared;
  }, [coreDerived, shoppingMode]);

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
    linkedMealLabels,
    ...mutations,
  };
}
