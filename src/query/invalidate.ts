import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

// Helpers for post–useQuery migration; invalidateQueries no-ops when nothing observes the key.

export function invalidateListData(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.homeList(userId) });
}

export function invalidateStores(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.stores(userId) });
}

export function invalidateAllUserData(queryClient: QueryClient, userId: string) {
  return Promise.all([
    invalidateListData(queryClient, userId),
    invalidateStores(queryClient, userId),
    queryClient.invalidateQueries({ queryKey: queryKeys.meals(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recipes(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.mealsRangeRoot(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.recipesScreenRoot(userId) }),
  ]);
}

export function invalidateMealsRange(queryClient: QueryClient, userId: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.mealsRangeRoot(userId) });
}
