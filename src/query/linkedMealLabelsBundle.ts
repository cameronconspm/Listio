import type { QueryClient } from '@tanstack/react-query';
import { getMealsByIds } from '../services/mealService';
import type { ListItem } from '../types/models';
import { linkedMealRowMeta, type LinkedMealRowMeta } from '../utils/mealLabel';
import { queryKeys } from './keys';
import { HOME_LIST_STALE_MS } from './homeListBundle';

export type LinkedMealLabelsBundle = Record<string, LinkedMealRowMeta>;

export function collectLinkedMealIds(items: ListItem[]): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    const linked = item.linked_meal_ids;
    if (!linked) continue;
    for (const id of linked) ids.add(id);
  }
  return Array.from(ids).sort();
}

export async function fetchLinkedMealLabelsBundle(mealIds: string[]): Promise<LinkedMealLabelsBundle> {
  if (mealIds.length === 0) return {};
  const meals = await getMealsByIds(mealIds);
  const bundle: LinkedMealLabelsBundle = {};
  for (const meal of meals) {
    bundle[meal.id] = linkedMealRowMeta(meal);
  }
  return bundle;
}

export function labelsMapFromBundle(
  bundle: LinkedMealLabelsBundle | undefined
): Map<string, LinkedMealRowMeta> {
  if (!bundle) return new Map();
  return new Map(Object.entries(bundle));
}

export function prefetchLinkedMealLabelsForItems(
  userId: string,
  listId: string,
  items: ListItem[],
  queryClient: QueryClient
): void {
  const mealIds = collectLinkedMealIds(items);
  if (mealIds.length === 0) return;
  const signature = mealIds.join(',');
  void queryClient.prefetchQuery({
    queryKey: queryKeys.linkedMealLabels(userId, listId, signature),
    queryFn: () => fetchLinkedMealLabelsBundle(mealIds),
    staleTime: HOME_LIST_STALE_MS,
  });
}

export function getCachedLinkedMealLabels(
  queryClient: QueryClient,
  userId: string,
  listId: string,
  signature: string
): LinkedMealLabelsBundle | undefined {
  return queryClient.getQueryData<LinkedMealLabelsBundle>(
    queryKeys.linkedMealLabels(userId, listId, signature)
  );
}
