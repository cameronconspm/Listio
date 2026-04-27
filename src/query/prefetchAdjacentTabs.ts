import type { QueryClient } from '@tanstack/react-query';
import { getScheduleDates, toDateString } from '../utils/dateUtils';
import { queryKeys } from './keys';
import { fetchRecipesScreenBundle, RECIPES_SCREEN_STALE_MS } from './recipesScreenBundle';
import { fetchMealsRangeBundle, MEALS_RANGE_STALE_MS } from './mealsRangeBundle';

/**
 * After the home list loads, warm Recipes + Meals caches so tab switches feel instant.
 * Meals window matches `useMealScheduleConfig` initial default (today, 7 days); if the user
 * changed the window in prefs, Meals still refetches the correct range on focus.
 */
export function prefetchRecipesAndDefaultMealsRange(userId: string, queryClient: QueryClient): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.recipesScreen(userId, 'all', 'updated_at'),
    queryFn: () => fetchRecipesScreenBundle(userId, 'all', 'updated_at'),
    staleTime: RECIPES_SCREEN_STALE_MS,
  });

  const startDate = toDateString(new Date());
  const length = 7;
  const visible = getScheduleDates(startDate, length);
  if (visible.length === 0) return;
  const rangeStart = toDateString(visible[0]);
  const rangeEnd = toDateString(visible[visible.length - 1]);

  void queryClient.prefetchQuery({
    queryKey: queryKeys.mealsRange(userId, rangeStart, rangeEnd),
    queryFn: () => fetchMealsRangeBundle(userId, rangeStart, rangeEnd),
    staleTime: MEALS_RANGE_STALE_MS,
  });
}
