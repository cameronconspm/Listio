import type { QueryClient } from '@tanstack/react-query';
import { fetchShoppingLists } from '../services/shoppingListService';
import { fetchUserPreferences } from '../services/userPreferencesService';
import type { ShoppingList } from '../types/models';
import type { UserPreferencesPayload } from '../types/preferences';
import { queryKeys } from './keys';

/** How long shopping list metadata is treated as fresh (list switcher + picker). */
export const SHOPPING_LISTS_STALE_MS = 60_000;

export type ShoppingListsBundle = {
  lists: ShoppingList[];
  activeListId: string | null;
  /** List-tab UI prefs captured during bootstrap so HomeScreen can paint without a second fetch. */
  listUi?: UserPreferencesPayload['listUi'];
};

export async function fetchShoppingListsBundle(): Promise<ShoppingListsBundle> {
  const [prefs, lists] = await Promise.all([fetchUserPreferences(), fetchShoppingLists()]);
  const preferred = prefs.listUi?.activeListId;
  const activeListId =
    preferred && lists.some((list) => list.id === preferred)
      ? preferred
      : lists.find((list) => list.is_default)?.id ?? lists[0]?.id ?? null;
  return { lists, activeListId, listUi: prefs.listUi };
}

export function prefetchShoppingLists(userId: string, queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.shoppingLists(userId),
    queryFn: fetchShoppingListsBundle,
    staleTime: SHOPPING_LISTS_STALE_MS,
  });
}

export function getCachedShoppingListsBundle(
  queryClient: QueryClient,
  userId: string
): ShoppingListsBundle | undefined {
  return queryClient.getQueryData<ShoppingListsBundle>(queryKeys.shoppingLists(userId));
}
