import type { QueryClient } from '@tanstack/react-query';
import { fetchListItems } from '../services/listService';
import { resolveActiveListId } from '../services/shoppingListService';
import { getStores } from '../services/storeService';
import type { ListItem, StoreProfile } from '../types/models';
import { queryKeys } from './keys';

/** How long home-bundle data is treated as fresh (tab focus + cache updates). */
export const HOME_LIST_STALE_MS = 60_000;

/** Shared with Store tab `useQuery` so the same `getStores` request fills both caches (deduped). */
export const STORES_QUERY_STALE_MS = 60_000;

export type HomeListBundle = {
  listItems: ListItem[];
  stores: StoreProfile[];
  /** Resolved default store for the list UI (default flag or first store). */
  store: StoreProfile | null;
};

/** First cached home bundle for a user (any active shopping list). */
export function getCachedHomeListBundle(
  queryClient: QueryClient,
  userId: string
): HomeListBundle | undefined {
  const entries = queryClient.getQueriesData<HomeListBundle>({
    queryKey: queryKeys.homeListAll(userId),
  });
  return entries.find(([, data]) => data !== undefined)?.[1];
}

/**
 * Single fetch used by the home list tab query: list rows + store context.
 * When `queryClient` is passed, stores are loaded via `fetchQuery` so the Store tab shares
 * the same React Query cache (no duplicate `getStores` + instant tab switch).
 *
 * Default store is derived from the same `getStores` result — no extra round-trip.
 */
export async function fetchHomeListBundle(
  userId: string,
  queryClient?: QueryClient,
  listId?: string
): Promise<HomeListBundle> {
  const resolvedListId = listId ?? (await resolveActiveListId());

  const storesPromise = queryClient
    ? queryClient.fetchQuery({
        queryKey: queryKeys.stores(userId),
        queryFn: () => getStores(userId),
        staleTime: STORES_QUERY_STALE_MS,
      })
    : getStores(userId);

  const [listItems, allStores] = await Promise.all([
    fetchListItems(userId, resolvedListId),
    storesPromise,
  ]);
  const defaultStore = allStores.find((s) => s.is_default) ?? allStores[0] ?? null;
  return { listItems, stores: allStores, store: defaultStore };
}

/** Start loading the home bundle as soon as the session is known (before Home tab mounts). */
export async function prefetchHomeListBundle(userId: string, queryClient: QueryClient): Promise<void> {
  const listId = await resolveActiveListId();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.homeList(userId, listId),
    queryFn: () => fetchHomeListBundle(userId, queryClient, listId),
    staleTime: HOME_LIST_STALE_MS,
  });
}

/** Warm caches for every shopping list in the household (list switcher). */
export async function prefetchAllHomeListBundles(
  userId: string,
  queryClient: QueryClient,
  listIds: string[]
): Promise<void> {
  await Promise.all(
    listIds.map((listId) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.homeList(userId, listId),
        queryFn: () => fetchHomeListBundle(userId, queryClient, listId),
        staleTime: HOME_LIST_STALE_MS,
      })
    )
  );
}
