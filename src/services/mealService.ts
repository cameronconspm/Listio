import { supabase, isSyncEnabled } from './supabaseClient';
import { getCurrentHouseholdId } from './householdService';
import { fetchListItems, insertListItems } from './listService';
import * as local from './localDataService';
import { normalize } from '../utils/normalize';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { sanitizeMealCreate, sanitizeMealIngredientInput, sanitizeMealUpdate } from '../utils/sanitizeUserText';
import type { Meal, MealIngredient, MealSlot, ZoneKey } from '../types/models';

export async function getMeals(userId: string): Promise<Meal[]> {
  if (!isSyncEnabled()) return local.getMeals(userId);
  const householdId = await getCurrentHouseholdId();
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []).map(mapMeal);
}

/** Fetch meals for a date range (inclusive). For planner week view. */
export async function getMealsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Meal[]> {
  if (!isSyncEnabled()) return local.getMealsByDateRange(userId, startDate, endDate);
  const householdId = await getCurrentHouseholdId();
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('household_id', householdId)
    .gte('meal_date', startDate)
    .lte('meal_date', endDate)
    .order('meal_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []).map(mapMeal);
}

export type MealWithIngredients = {
  meal: {
    id: string;
    name: string;
    meal_date: string;
    meal_slot: MealSlot;
    custom_slot_name: string | null;
    recipe_url: string | null;
    notes: string | null;
  };
  ingredients: MealIngredient[];
};

export async function getMealWithIngredients(mealId: string): Promise<MealWithIngredients> {
  if (!isSyncEnabled()) return local.getMealWithIngredients(mealId);
  const { data: meal, error: mealErr } = await supabase
    .from('meals')
    .select('id, name, meal_date, meal_slot, custom_slot_name, recipe_url, notes')
    .eq('id', mealId)
    .single();

  if (mealErr || !meal) {
    throw new Error('Meal not found');
  }

  const { data: ings } = await supabase
    .from('meal_ingredients')
    .select('*')
    .eq('meal_id', mealId)
    .order('id', { ascending: true });

  return {
    meal: {
      id: meal.id,
      name: meal.name,
      meal_date: meal.meal_date as string,
      meal_slot: meal.meal_slot as MealSlot,
      custom_slot_name: meal.custom_slot_name as string | null,
      recipe_url: meal.recipe_url as string | null,
      notes: meal.notes as string | null,
    },
    ingredients: (ings ?? []).map(mapMealIngredient),
  };
}

export interface CreateMealInput {
  name: string;
  meal_date: string;
  meal_slot: MealSlot;
  custom_slot_name?: string | null;
  recipe_id?: string | null;
  recipe_url?: string | null;
  notes?: string | null;
}

export async function createMeal(userId: string, data: CreateMealInput): Promise<Meal> {
  if (!isSyncEnabled()) return local.createMeal(userId, data);
  const d = sanitizeMealCreate(data);
  const householdId = await getCurrentHouseholdId();
  const payload: Record<string, unknown> = {
    user_id: userId,
    household_id: householdId,
    name: d.name,
    meal_date: d.meal_date,
    meal_slot: d.meal_slot,
    recipe_id: d.recipe_id ?? null,
    recipe_url: d.recipe_url ?? null,
    notes: d.notes ?? null,
  };
  if (d.custom_slot_name != null && d.custom_slot_name !== '') {
    payload.custom_slot_name = d.custom_slot_name;
  }

  const { data: m, error } = await supabase
    .from('meals')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not create meal.'));
  return mapMeal(m);
}

export interface UpdateMealInput {
  name?: string;
  meal_date?: string;
  meal_slot?: MealSlot;
  custom_slot_name?: string | null;
  recipe_url?: string | null;
  notes?: string | null;
}

export async function updateMeal(mealId: string, data: UpdateMealInput): Promise<void> {
  if (!isSyncEnabled()) return local.updateMeal(mealId, data);
  const safe = sanitizeMealUpdate(data);
  const payload: Record<string, unknown> = {};
  if (safe.name != null) payload.name = safe.name;
  if (safe.meal_date !== undefined) payload.meal_date = safe.meal_date;
  if (safe.meal_slot !== undefined) payload.meal_slot = safe.meal_slot;
  if (safe.custom_slot_name != null && safe.custom_slot_name !== '') {
    payload.custom_slot_name = safe.custom_slot_name;
  }
  if (safe.recipe_url !== undefined) payload.recipe_url = safe.recipe_url;
  if (safe.notes !== undefined) payload.notes = safe.notes;
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from('meals').update(payload).eq('id', mealId);
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not update meal.'));
}

export async function deleteMeal(mealId: string): Promise<void> {
  if (!isSyncEnabled()) return local.deleteMeal(mealId);
  const { error } = await supabase.from('meals').delete().eq('id', mealId);
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not delete meal.'));
}

export interface MealIngredientInput {
  name: string;
  normalized_name?: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes?: string | null;
  brand_preference?: string | null;
}

export async function setMealIngredients(
  mealId: string,
  ingredients: MealIngredientInput[]
): Promise<void> {
  if (!isSyncEnabled()) return local.setMealIngredients(mealId, ingredients);
  const { error: deleteErr } = await supabase.from('meal_ingredients').delete().eq('meal_id', mealId);
  if (deleteErr) throw new Error(mapDbErrorToUserMessage(deleteErr, 'Could not update meal ingredients.'));

  if (ingredients.length === 0) return;

  const fullRows = ingredients.map((raw) => {
    const i = sanitizeMealIngredientInput(raw);
    return {
      meal_id: mealId,
      name: i.name,
      normalized_name: i.normalized_name ?? normalize(i.name),
      quantity_value: i.quantity_value,
      quantity_unit: i.quantity_unit,
      notes: i.notes ?? null,
      brand_preference: i.brand_preference ?? null,
    };
  });

  let { error: insertErr } = await supabase.from('meal_ingredients').insert(fullRows);
  if (insertErr?.code === 'PGRST204') {
    const legacyRows = fullRows.map(
      ({ normalized_name: _n, brand_preference: _b, ...rest }) => rest
    );
    ({ error: insertErr } = await supabase.from('meal_ingredients').insert(legacyRows));
  }
  if (insertErr) throw new Error(mapDbErrorToUserMessage(insertErr, 'Could not update meal ingredients.'));
}

/**
 * Copy a meal (with ingredients) to additional dates. Creates new meals for each target date.
 * Does not modify the original meal.
 */
export async function copyMealToDates(
  mealId: string,
  userId: string,
  targetDates: string[]
): Promise<{ created: number }> {
  if (!isSyncEnabled()) return local.copyMealToDates(mealId, userId, targetDates);
  if (targetDates.length === 0) return { created: 0 };
  const { meal, ingredients } = await getMealWithIngredients(mealId);
  const ings: MealIngredientInput[] = ingredients.map((i) => ({
    name: i.name,
    normalized_name: i.normalized_name || undefined,
    quantity_value: i.quantity_value,
    quantity_unit: i.quantity_unit,
    notes: i.notes ?? undefined,
    brand_preference: i.brand_preference ?? undefined,
  }));
  let created = 0;
  for (const meal_date of targetDates) {
    const newMeal = await createMeal(userId, {
      name: meal.name,
      meal_date,
      meal_slot: meal.meal_slot,
      custom_slot_name: meal.custom_slot_name,
      recipe_url: meal.recipe_url,
      notes: meal.notes,
    });
    await setMealIngredients(newMeal.id, ings);
    created++;
  }
  return { created };
}

export async function addMissingIngredientsToList(mealId: string, userId: string): Promise<void> {
  if (!isSyncEnabled()) return local.addMissingIngredientsToList(mealId, userId);
  const { data: ings } = await supabase
    .from('meal_ingredients')
    .select('name, normalized_name, quantity_value, quantity_unit')
    .eq('meal_id', mealId);

  if (!ings?.length) return;

  const existingList = await fetchListItems(userId);
  const existingNormalized = new Set(existingList.map((i) => i.normalized_name));

  const missing = ings.filter(
    (i) => !existingNormalized.has(i.normalized_name || normalize(i.name))
  );
  if (missing.length === 0) return;

  const items = missing.map((i) => ({
    user_id: userId,
    name: i.name,
    normalized_name: i.normalized_name || normalize(i.name),
    category: '',
    zone_key: 'other' as ZoneKey,
    quantity_value: i.quantity_value != null ? Number(i.quantity_value) : null,
    quantity_unit: i.quantity_unit,
    notes: null,
    is_checked: false,
    linked_meal_ids: [mealId],
  }));

  await insertListItems(userId, items);
}

/** Get ingredient counts for given meal IDs. Returns map of mealId -> count. */
export async function getMealIngredientCounts(mealIds: string[]): Promise<Map<string, number>> {
  if (mealIds.length === 0) return new Map();
  if (!isSyncEnabled()) return local.getMealIngredientCounts(mealIds);
  const { data, error } = await supabase
    .from('meal_ingredients')
    .select('meal_id')
    .in('meal_id', mealIds);

  if (error) return new Map();
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const mid = row.meal_id as string;
    counts.set(mid, (counts.get(mid) ?? 0) + 1);
  }
  return counts;
}

/**
 * Future: Save meal as recipe.
 * Creates a recipes row, copies meal_ingredients to recipe_ingredients, sets meal.recipe_id.
 * Stub for Phase C / future Recipes tab integration.
 */
export function mealToRecipePayload(_mealId: string): {
  name: string;
  ingredients: { name: string; quantity_value: number | null; quantity_unit: string | null; notes: string | null }[];
} | null {
  return null;
}

/**
 * Future: Create meal from recipe.
 * Creates meal with recipe_id, copies recipe_ingredients to meal_ingredients.
 * Stub for Phase C / future Recipes tab integration.
 */
export function recipeToMealPayload(
  _recipeId: string,
  _date: string,
  _slot: MealSlot
): {
  name: string;
  meal_date: string;
  meal_slot: MealSlot;
  recipe_id: string;
  ingredients: MealIngredientInput[];
} | null {
  return null;
}

/** Fetch meals by IDs. For List tab linkage display. */
export async function getMealsByIds(mealIds: string[]): Promise<Meal[]> {
  if (mealIds.length === 0) return [];
  if (!isSyncEnabled()) return local.getMealsByIds(mealIds);
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .in('id', mealIds);

  if (error) return [];
  return (data ?? []).map(mapMeal);
}

function mapMeal(row: Record<string, unknown>): Meal {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    household_id: row.household_id as string | undefined,
    name: row.name as string,
    recipe_id: row.recipe_id as string | null,
    start_date: row.start_date as string | null,
    end_date: row.end_date as string | null,
    meal_date: (row.meal_date as string) ?? '',
    meal_slot: (row.meal_slot as MealSlot) ?? 'dinner',
    custom_slot_name: row.custom_slot_name as string | null,
    recipe_url: row.recipe_url as string | null,
    notes: row.notes as string | null,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function mapMealIngredient(row: Record<string, unknown>): MealIngredient {
  return {
    id: row.id as string,
    meal_id: row.meal_id as string,
    name: row.name as string,
    normalized_name: (row.normalized_name as string) ?? '',
    quantity_value: row.quantity_value != null ? Number(row.quantity_value) : null,
    quantity_unit: row.quantity_unit as string | null,
    notes: row.notes as string | null,
    brand_preference: row.brand_preference as string | null,
  };
}
