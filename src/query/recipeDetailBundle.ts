import { getRecipeWithIngredients } from '../services/recipeService';

export const RECIPE_DETAIL_STALE_MS = 60_000;

export type RecipeDetailBundle = Awaited<ReturnType<typeof getRecipeWithIngredients>>;

export async function fetchRecipeDetailBundle(recipeId: string): Promise<RecipeDetailBundle> {
  return getRecipeWithIngredients(recipeId);
}
