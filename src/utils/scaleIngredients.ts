import type { RecipeIngredient } from '../types/models';

/**
 * Scale recipe ingredients by servings.
 * Returns new ingredient objects with scaled quantity_value.
 */
export function scaleIngredients(
  ingredients: RecipeIngredient[],
  baseServings: number,
  displayServings: number
): RecipeIngredient[] {
  if (baseServings <= 0) return ingredients;
  const factor = displayServings / baseServings;

  return ingredients.map((ing) => ({
    ...ing,
    quantity_value:
      ing.quantity_value != null
        ? Math.round(ing.quantity_value * factor * 100) / 100
        : null,
  }));
}
