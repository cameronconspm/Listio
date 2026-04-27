import type { QueryClient } from '@tanstack/react-query';
import { fetchListItems } from '../services/listService';
import { getDefaultStore, getStores } from '../services/storeService';
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

/**
 * Single fetch used by the home list tab query: list rows + store context.
 * When `queryClient` is passed, stores are loaded via `fetchQuery` so the Store tab shares
 * the same React Query cache (no duplicate `getStores` + instant tab switch).
 */
export async function fetchHomeListBundle(
  userId: string,
  queryClient?: QueryClient
): Promise<HomeListBundle> {
  const listPromise = fetchListItems(userId);
  const storesPromise = queryClient
    ? queryClient.fetchQuery({
        queryKey: queryKeys.stores(userId),
        queryFn: () => getStores(userId),
        staleTime: STORES_QUERY_STALE_MS,
      })
    : getStores(userId);
  const defaultPromise = getDefaultStore(userId);

  const [listItems, allStores, defaultStore] = await Promise.all([
    listPromise,
    storesPromise,
    defaultPromise,
  ]);
  const nextStore = defaultStore ?? allStores[0] ?? null;
  return { listItems, stores: allStores, store: nextStore };
}
