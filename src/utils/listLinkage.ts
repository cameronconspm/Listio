import type { MealIngredient } from '../types/models';

/**
 * Compute which meal ingredients are on the list vs missing.
 * Matching rule: normalized_name equality (no unit check in v1).
 */
export function computeListLinkage(
  ingredients: MealIngredient[],
  listNormalizedNames: Set<string>
): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const ing of ingredients) {
    const norm = ing.normalized_name || ing.name.toLowerCase().trim().replace(/\s+/g, ' ');
    result.set(ing.id, listNormalizedNames.has(norm));
  }
  return result;
}
