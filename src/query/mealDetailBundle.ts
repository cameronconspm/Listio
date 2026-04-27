import { getMealWithIngredients } from '../services/mealService';
import { fetchListItems } from '../services/listService';
import { computeListLinkage } from '../utils/listLinkage';
import { mapToRecord } from '../utils/mapToJson';

export const MEAL_DETAIL_STALE_MS = 60_000;

export type MealDetailBundle = {
  meal: Awaited<ReturnType<typeof getMealWithIngredients>>['meal'];
  ingredients: Awaited<ReturnType<typeof getMealWithIngredients>>['ingredients'];
  /** Ingredient row id → whether a matching list item exists (JSON-safe). */
  linkageByIngredientId: Record<string, boolean>;
};

export async function fetchMealDetailBundle(userId: string, mealId: string): Promise<MealDetailBundle> {
  const [{ meal, ingredients }, listItems] = await Promise.all([
    getMealWithIngredients(mealId),
    fetchListItems(userId),
  ]);
  const listNorm = new Set(listItems.map((i) => i.normalized_name));
  const linkageMap = computeListLinkage(ingredients, listNorm);
  return {
    meal,
    ingredients,
    linkageByIngredientId: mapToRecord(linkageMap),
  };
}
