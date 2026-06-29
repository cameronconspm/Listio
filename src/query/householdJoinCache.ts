import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';
import { fetchHomeListBundle, HOME_LIST_STALE_MS } from './homeListBundle';
import {
  fetchShareListBundle,
  SHARE_LIST_STALE_MS,
  type ShareListBundle,
} from './shareListBundle';
import {
  fetchShoppingListsBundle,
  SHOPPING_LISTS_STALE_MS,
} from './shoppingListsBundle';

/**
 * After joining a shared household, refresh list metadata + warm the active home bundle
 * so the List tab and Share screen feel instant instead of waiting on serial invalidations.
 */
export async function warmCachesAfterHouseholdJoin(
  userId: string,
  queryClient: QueryClient
): Promise<void> {
  const [listsBundle] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.shoppingLists(userId),
      queryFn: fetchShoppingListsBundle,
      staleTime: SHOPPING_LISTS_STALE_MS,
    }),
    queryClient.fetchQuery({
      queryKey: queryKeys.shareList(userId),
      queryFn: fetchShareListBundle,
      staleTime: SHARE_LIST_STALE_MS,
    }),
  ]);

  if (listsBundle.activeListId) {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.homeList(userId, listsBundle.activeListId),
      queryFn: () => fetchHomeListBundle(userId, queryClient, listsBundle.activeListId!),
      staleTime: HOME_LIST_STALE_MS,
    });
  }
}

/** Optimistically drop an accepted invite from the Share list cache. */
export function optimisticallyRemoveIncomingInvite(
  queryClient: QueryClient,
  userId: string,
  token: string
): ShareListBundle | undefined {
  const key = queryKeys.shareList(userId);
  const previous = queryClient.getQueryData<ShareListBundle>(key);
  if (!previous) return undefined;

  const next: ShareListBundle = {
    ...previous,
    incomingInvites: previous.incomingInvites.filter((inv) => inv.token !== token),
    isSharedHousehold: true,
    isOwner: false,
  };
  queryClient.setQueryData(key, next);
  return previous;
}

export function restoreShareListBundle(
  queryClient: QueryClient,
  userId: string,
  snapshot: ShareListBundle | undefined
): void {
  if (!snapshot) return;
  queryClient.setQueryData(queryKeys.shareList(userId), snapshot);
}
