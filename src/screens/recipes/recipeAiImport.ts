import type { ParsedRecipeDraft } from '../../types/api';
import type { RecipeCategory } from '../../types/models';
import { splitCompoundIngredientLine } from '../../utils/splitIngredientLine';

export type RecipeIngredientFormRow = {
  name: string;
  quantity_value: string;
  quantity_unit: string;
  notes: string;
};

const FALLBACK_UNIT = 'ea';

function formatQuantity(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '';
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

function normalizeCategory(input: RecipeCategory | null): RecipeCategory | null {
  return input ?? null;
}

export function mapParsedRecipeDraftToForm(draft: ParsedRecipeDraft): {
  name: string;
  servings: string;
  totalTimeMinutes: string;
  category: RecipeCategory | null;
  instructions: string;
  notes: string;
  recipeUrl: string;
  ingredients: RecipeIngredientFormRow[];
} {
  const ingredients = (draft.ingredients ?? [])
    .filter((row) => Boolean(row?.name?.trim()))
    .map((row) => {
      let name = row.name.trim();
      let quantity_value = row.quantity_value;
      let quantity_unit = row.quantity_unit?.trim() ?? '';
      let notes = row.notes?.trim() ?? '';

      const missingQty =
        quantity_value == null || (typeof quantity_value === 'number' && Number.isNaN(quantity_value));
      if (missingQty && !quantity_unit && name) {
        const split = splitCompoundIngredientLine(name);
        if (split.quantity_value != null && split.quantity_unit && split.name) {
          name = split.name;
          quantity_value = split.quantity_value;
          quantity_unit = split.quantity_unit;
          if (split.notes && !notes) notes = split.notes;
        }
      }

      return {
        name,
        quantity_value: formatQuantity(quantity_value),
        quantity_unit: quantity_unit || FALLBACK_UNIT,
        notes,
      };
    });

  return {
    name: draft.name?.trim() ?? '',
    servings: draft.servings != null ? String(draft.servings) : '',
    totalTimeMinutes: draft.total_time_minutes != null ? String(draft.total_time_minutes) : '',
    category: normalizeCategory(draft.category ?? null),
    instructions: draft.instructions?.trim() ?? '',
    notes: draft.notes?.trim() ?? '',
    recipeUrl: draft.recipe_url?.trim() ?? '',
    ingredients,
  };
}
