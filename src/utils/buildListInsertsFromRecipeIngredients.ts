import type { ListItemInsert } from '../services/listService';
import type { ZoneKey } from '../types/models';
import { ZONE_KEYS } from '../data/zone';
import { normalize } from './normalize';

const VALID_ZONES = new Set<string>(ZONE_KEYS);

function coerceZoneKey(z: string | undefined | null): ZoneKey {
  if (z && VALID_ZONES.has(z)) return z as ZoneKey;
  return 'other';
}

export type RecipeIngredientForList = {
  name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
};

export type RecipeListCategorizeContext = {
  storeType?: string;
  zoneLabelsInOrder?: string[];
};

/**
 * Build list rows from recipe ingredients, using the same categorize-items path as quick-add.
 */
export async function buildListInsertsFromRecipeIngredients(
  rows: RecipeIngredientForList[],
  userId: string,
  scaleFactor: number,
  categorize?: RecipeListCategorizeContext,
  /** When set, list rows are tied to planned meals (e.g. recipe added to meals before “add to list”). */
  linkedMealIds?: string[]
): Promise<ListItemInsert[]> {
  if (rows.length === 0) return [];

  const names = rows.map((r) => r.name);
  const storeType = categorize?.storeType ?? 'generic';
  const zoneLabelsInOrder = categorize?.zoneLabelsInOrder;

  let results: { normalized_name: string; category: string; zone_key: string }[];
  try {
    const { categorizeItems } = await import('../services/aiService');
    const res = await categorizeItems(names, storeType, zoneLabelsInOrder);
    results = res.results;
  } catch {
    results = names.map((name) => ({
      normalized_name: normalize(name),
      category: '',
      zone_key: 'other',
    }));
  }

  if (results.length !== names.length) {
    results = names.map((name) => ({
      normalized_name: normalize(name),
      category: '',
      zone_key: 'other',
    }));
  }

  const mealLinks = linkedMealIds?.length ? [...new Set(linkedMealIds)] : [];

  return rows.map((row, i) => {
    const r = results[i];
    let qty: number | null = row.quantity_value != null ? Number(row.quantity_value) : null;
    if (qty != null && scaleFactor !== 1) {
      qty = Math.round(qty * scaleFactor * 100) / 100;
    }
    return {
      user_id: userId,
      name: r.normalized_name,
      normalized_name: r.normalized_name,
      category: r.category ?? '',
      zone_key: coerceZoneKey(r.zone_key),
      quantity_value: qty,
      quantity_unit: row.quantity_unit,
      notes: null,
      is_checked: false,
      linked_meal_ids: mealLinks,
    };
  });
}
