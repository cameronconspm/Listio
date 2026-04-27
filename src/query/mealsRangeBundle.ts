import { getMealsByDateRange, getMealIngredientCounts } from '../services/mealService';
import type { Meal } from '../types/models';
import { mapToRecord } from '../utils/mapToJson';

export const MEALS_RANGE_STALE_MS = 60_000;

export type MealsRangeBundle = {
  meals: Meal[];
  ingredientCounts: Record<string, number>;
};

export async function fetchMealsRangeBundle(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<MealsRangeBundle> {
  const mealsData = await getMealsByDateRange(userId, rangeStart, rangeEnd);
  let ingredientCounts: Record<string, number> = {};
  if (mealsData.length > 0) {
    const counts = await getMealIngredientCounts(mealsData.map((m) => m.id));
    ingredientCounts = mapToRecord(counts);
  }
  return { meals: mealsData, ingredientCounts };
}
