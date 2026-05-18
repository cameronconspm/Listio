import { RECIPE_CATEGORY_LABELS } from '../components/recipes/RecipeCategorySheet';
import type { RecipeCategory } from '../types/models';
import { formatRecipeDurationMinutes } from './formatRecipeDuration';

export type MealPlannerRecipeMeta = {
  servings: number;
  total_time_minutes?: number | null;
  category?: RecipeCategory | null;
};

/**
 * Planner subtitle when the meal is linked to a recipe: always two parts — servings plus time or category.
 * Never returns servings alone.
 */
export function formatMealPlannerRecipeMetaLine(meta: MealPlannerRecipeMeta | null | undefined): string | null {
  if (!meta || meta.servings <= 0) return null;

  const servingsPart = `${meta.servings} serving${meta.servings === 1 ? '' : 's'}`;
  const timeLabel = formatRecipeDurationMinutes(meta.total_time_minutes);
  if (timeLabel) {
    return `${servingsPart} · ${timeLabel}`;
  }

  const cat = meta.category;
  if (cat) {
    const catLabel = RECIPE_CATEGORY_LABELS[cat] ?? cat;
    return `${servingsPart} · ${catLabel}`;
  }

  return null;
}
