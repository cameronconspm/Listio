import {
  getRecipes,
  getRecipeIngredientCounts,
  type RecipeFilter,
  type RecipeSortKey,
} from '../services/recipeService';
import type { Recipe } from '../types/models';
import { mapToRecord } from '../utils/mapToJson';

export const RECIPES_SCREEN_STALE_MS = 60_000;

export type RecipesScreenBundle = {
  recipes: Recipe[];
  allRecipesCount: number;
  ingredientCounts: Record<string, number>;
};

/**
 * Ingredient names are intentionally excluded from this bundle — they are only needed for
 * search and are lazy-fetched (and debounced) via a separate query to keep initial load fast.
 */
export async function fetchRecipesScreenBundle(
  userId: string,
  filter: RecipeFilter,
  sort: RecipeSortKey
): Promise<RecipesScreenBundle> {
  const data = await getRecipes(userId, { filter, sort });
  let allRecipesCount: number;
  if (filter === 'all') {
    allRecipesCount = data.length;
  } else {
    const allData = await getRecipes(userId, { filter: 'all', sort: 'updated_at' });
    allRecipesCount = allData.length;
  }

  let ingredientCounts: Record<string, number> = {};
  if (data.length > 0) {
    const ids = data.map((r) => r.id);
    const counts = await getRecipeIngredientCounts(ids);
    ingredientCounts = mapToRecord(counts);
  }

  return { recipes: data, allRecipesCount, ingredientCounts };
}
