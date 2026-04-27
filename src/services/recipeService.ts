import { supabase, isSyncEnabled } from './supabaseClient';
import { getCurrentHouseholdId } from './householdService';
import { insertListItems } from './listService';
import { createMeal, setMealIngredients, type MealIngredientInput } from './mealService';
import * as local from './localDataService';
import { normalize } from '../utils/normalize';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import {
  sanitizeDuplicateRecipeName,
  sanitizeRecipeCreate,
  sanitizeRecipeIngredientInput,
  sanitizeRecipeUpdate,
} from '../utils/sanitizeUserText';
import type { Recipe, RecipeIngredient, RecipeCategory, MealSlot } from '../types/models';
import {
  buildListInsertsFromRecipeIngredients,
  type RecipeListCategorizeContext,
} from '../utils/buildListInsertsFromRecipeIngredients';

export type { RecipeListCategorizeContext };

export type RecipeFilter = 'all' | 'favorites' | RecipeCategory | 'recent';
export type RecipeSortKey = 'updated_at' | 'created_at' | 'name' | 'servings' | 'ingredient_count';

export type GetRecipesOptions = {
  filter?: RecipeFilter;
  sort?: RecipeSortKey;
};

export async function getRecipes(userId: string, options?: GetRecipesOptions): Promise<Recipe[]> {
  if (!isSyncEnabled()) return local.getRecipes(userId, options);
  const householdId = await getCurrentHouseholdId();
  let query = supabase.from('recipes').select('*').eq('household_id', householdId);

  const filter = options?.filter ?? 'all';
  if (filter === 'favorites') {
    query = query.eq('is_favorite', true);
  } else if (filter !== 'all' && filter !== 'recent') {
    query = query.eq('category', filter);
  }

  const sort = options?.sort ?? 'updated_at';
  const useRecentSort = filter === 'recent';
  if (!useRecentSort) {
    if (sort === 'updated_at') {
      query = query.order('updated_at', { ascending: false });
    } else if (sort === 'created_at') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'name') {
      query = query.order('name', { ascending: true });
    } else if (sort === 'servings') {
      query = query.order('servings', { ascending: true });
    } else if (sort === 'ingredient_count') {
      // Server-side sort via migration 029 column; avoids a second round-trip.
      query = query.order('ingredient_count', { ascending: false });
    }
  }

  const { data, error } = await query;
  if (error) return [];

  let recipes = (data ?? []).map(mapRecipe);

  if (useRecentSort) {
    recipes = [...recipes].sort((a, b) => {
      const aDate = a.last_used_at || a.updated_at || a.created_at || '';
      const bDate = b.last_used_at || b.updated_at || b.created_at || '';
      return bDate.localeCompare(aDate);
    });
  }

  return recipes;
}

export async function toggleRecipeFavorite(recipeId: string): Promise<void> {
  if (!isSyncEnabled()) return local.toggleRecipeFavorite(recipeId);
  const { data: current } = await supabase
    .from('recipes')
    .select('is_favorite')
    .eq('id', recipeId)
    .single();
  if (!current) return;
  await supabase
    .from('recipes')
    .update({ is_favorite: !current.is_favorite })
    .eq('id', recipeId);
}

export async function getRecipeWithIngredients(recipeId: string): Promise<{
  recipe: {
    id: string;
    name: string;
    servings: number;
    total_time_minutes?: number | null;
    recipe_url?: string | null;
    notes?: string | null;
    instructions?: string | null;
    is_favorite?: boolean;
    category?: RecipeCategory | null;
  };
  ingredients: RecipeIngredient[];
}> {
  if (!isSyncEnabled()) return local.getRecipeWithIngredients(recipeId);
  // Use * so older DBs without instructions/total_time_minutes columns still load (migration 021).
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single();

  if (recipeErr || !recipe) {
    throw new Error('Recipe not found');
  }

  const { data: ings } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('id', { ascending: true });

  return {
    recipe: {
      id: recipe.id,
      name: recipe.name,
      servings: recipe.servings,
      total_time_minutes:
        recipe.total_time_minutes != null ? Number(recipe.total_time_minutes) : null,
      recipe_url: recipe.recipe_url ?? null,
      notes: recipe.notes ?? null,
      instructions: recipe.instructions ?? null,
      is_favorite: recipe.is_favorite ?? false,
      category: (recipe.category as Recipe['category']) ?? null,
    },
    ingredients: (ings ?? []).map(mapRecipeIngredient),
  };
}

export async function createRecipe(
  userId: string,
  data: {
    name: string;
    servings: number;
    category?: RecipeCategory | null;
    recipe_url?: string | null;
    notes?: string | null;
    instructions?: string | null;
    total_time_minutes?: number | null;
  }
): Promise<Recipe> {
  if (!isSyncEnabled()) return local.createRecipe(userId, data);
  const d = sanitizeRecipeCreate(data);
  const householdId = await getCurrentHouseholdId();
  const basePayload: Record<string, unknown> = {
    user_id: userId,
    household_id: householdId,
    name: d.name,
    servings: d.servings,
  };
  const fullPayload: Record<string, unknown> = { ...basePayload };
  if (d.category !== undefined) fullPayload.category = d.category;
  if (d.recipe_url !== undefined) fullPayload.recipe_url = d.recipe_url;
  if (d.notes !== undefined) fullPayload.notes = d.notes;
  if (d.instructions !== undefined) {
    fullPayload.instructions = typeof d.instructions === 'string' && d.instructions.trim() ? d.instructions : null;
  }
  if (d.total_time_minutes !== undefined) fullPayload.total_time_minutes = d.total_time_minutes;

  let result = await supabase.from('recipes').insert(fullPayload).select().single();
  if (result.error?.code === 'PGRST204') {
    result = await supabase.from('recipes').insert(basePayload).select().single();
  }

  if (result.error) throw new Error(mapDbErrorToUserMessage(result.error, 'Could not create recipe.'));
  return mapRecipe(result.data as Record<string, unknown>);
}

export async function updateRecipe(
  recipeId: string,
  data: {
    name: string;
    servings: number;
    category?: RecipeCategory | null;
    recipe_url?: string | null;
    notes?: string | null;
    instructions?: string | null;
    total_time_minutes?: number | null;
  }
): Promise<void> {
  if (!isSyncEnabled()) return local.updateRecipe(recipeId, data);
  const d = sanitizeRecipeUpdate(data);
  const updateData: Record<string, unknown> = {
    name: d.name,
    servings: d.servings,
  };
  if (d.category !== undefined) updateData.category = d.category;
  if (d.recipe_url !== undefined) updateData.recipe_url = d.recipe_url;
  if (d.notes !== undefined) updateData.notes = d.notes;
  if (d.instructions !== undefined) {
    updateData.instructions =
      typeof d.instructions === 'string' && d.instructions.trim() ? d.instructions : null;
  }
  if (d.total_time_minutes !== undefined) updateData.total_time_minutes = d.total_time_minutes;
  await supabase.from('recipes').update(updateData).eq('id', recipeId);
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  if (!isSyncEnabled()) return local.deleteRecipe(recipeId);
  await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not delete recipe.'));
}

export async function duplicateRecipe(recipeId: string, userId: string): Promise<Recipe> {
  if (!isSyncEnabled()) return local.duplicateRecipe(recipeId, userId);
  const { data: orig, error: recipeErr } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single();
  if (recipeErr || !orig) throw new Error('Recipe not found');

  const householdId = (orig.household_id as string) || (await getCurrentHouseholdId());
  const { data: newRecipe, error: insertErr } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      household_id: householdId,
      name: sanitizeDuplicateRecipeName(orig.name as string),
      servings: orig.servings,
      total_time_minutes: orig.total_time_minutes ?? null,
      recipe_url: orig.recipe_url,
      notes: orig.notes,
      instructions: orig.instructions ?? null,
      is_favorite: false,
      category: orig.category,
    })
    .select()
    .single();
  if (insertErr || !newRecipe) {
    throw new Error(
      insertErr ? mapDbErrorToUserMessage(insertErr, 'Could not duplicate recipe.') : 'Could not duplicate recipe.'
    );
  }

  const { data: ings } = await supabase
    .from('recipe_ingredients')
    .select('name, quantity_value, quantity_unit, notes')
    .eq('recipe_id', recipeId);
  if (ings?.length) {
    await supabase.from('recipe_ingredients').insert(
      ings.map((row) => {
        const i = sanitizeRecipeIngredientInput({
          name: row.name,
          quantity_value: row.quantity_value,
          quantity_unit: row.quantity_unit,
          notes: row.notes ?? null,
        });
        return {
        recipe_id: newRecipe.id,
        name: i.name,
        quantity_value: i.quantity_value,
        quantity_unit: i.quantity_unit,
        notes: i.notes,
      };
      })
    );
  }
  return mapRecipe(newRecipe);
}

export async function getRecipeIngredientCounts(recipeIds: string[]): Promise<Map<string, number>> {
  if (recipeIds.length === 0) return new Map();
  if (!isSyncEnabled()) return local.getRecipeIngredientCounts(recipeIds);
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id')
    .in('recipe_id', recipeIds);

  if (error) return new Map();
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const rid = row.recipe_id as string;
    counts.set(rid, (counts.get(rid) ?? 0) + 1);
  }
  return counts;
}

/**
 * Server-side search for recipe ids matching a query across recipe names and
 * ingredient names (via `search_tsv` gin index; see migration 029). Returns
 * `null` when sync is disabled so the caller can fall back to client search.
 */
export async function searchRecipeIds(
  query: string,
  limit = 200
): Promise<Set<string> | null> {
  const q = query.trim();
  if (!isSyncEnabled() || q.length === 0) return null;
  const householdId = await getCurrentHouseholdId();
  if (!householdId) return null;
  const { data, error } = await supabase.rpc('search_recipe_ids', {
    p_household_id: householdId,
    p_query: q,
    p_limit: limit,
  });
  if (error) return null;
  const ids = new Set<string>();
  for (const row of (data ?? []) as { id: string }[]) {
    ids.add(row.id);
  }
  return ids;
}

/** Ingredient display names per recipe, for search. */
export async function getRecipeIngredientNamesByRecipeIds(
  recipeIds: string[]
): Promise<Map<string, string[]>> {
  if (recipeIds.length === 0) return new Map();
  if (!isSyncEnabled()) return local.getRecipeIngredientNamesByRecipeIds(recipeIds);
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('recipe_id, name')
    .in('recipe_id', recipeIds);

  if (error) return new Map();
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const rid = row.recipe_id as string;
    const name = (row.name as string) ?? '';
    if (!map.has(rid)) map.set(rid, []);
    map.get(rid)!.push(name);
  }
  return map;
}

export interface RecipeIngredientInput {
  name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
}

export async function setRecipeIngredients(
  recipeId: string,
  ingredients: RecipeIngredientInput[]
): Promise<void> {
  if (!isSyncEnabled()) return local.setRecipeIngredients(recipeId, ingredients);
  await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);

  if (ingredients.length === 0) return;

  await supabase
    .from('recipe_ingredients')
    .insert(
      ingredients.map((raw) => {
        const i = sanitizeRecipeIngredientInput(raw);
        return {
        recipe_id: recipeId,
        name: i.name,
        quantity_value: i.quantity_value,
        quantity_unit: i.quantity_unit,
        notes: i.notes,
      };
      })
    );
}

export async function addRecipeToMeals(
  recipeId: string,
  userId: string,
  meal: {
    meal_date: string;
    meal_slot: MealSlot;
    custom_slot_name?: string | null;
  }
): Promise<void> {
  if (!isSyncEnabled()) return local.addRecipeToMeals(recipeId, userId, meal);
  const { data: recipe } = await supabase
    .from('recipes')
    .select('name')
    .eq('id', recipeId)
    .single();

  if (!recipe) throw new Error('Recipe not found');

  const { data: recipeIngs } = await supabase
    .from('recipe_ingredients')
    .select('name, quantity_value, quantity_unit, notes')
    .eq('recipe_id', recipeId)
    .order('id', { ascending: true });

  const created = await createMeal(userId, {
    name: recipe.name as string,
    meal_date: meal.meal_date,
    meal_slot: meal.meal_slot,
    custom_slot_name: meal.meal_slot === 'custom' ? meal.custom_slot_name ?? null : null,
    recipe_id: recipeId,
    recipe_url: null,
    notes: null,
  });

  if (recipeIngs?.length) {
    const mealIngredients: MealIngredientInput[] = recipeIngs.map((row) => ({
      name: row.name as string,
      quantity_value: row.quantity_value != null ? Number(row.quantity_value) : null,
      quantity_unit: (row.quantity_unit as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      brand_preference: null,
    }));
    await setMealIngredients(created.id, mealIngredients);
    await linkExistingListItemsToMeal(
      created.id,
      recipeIngs.map((row) => String(row.name ?? ''))
    );
  }

  await supabase.from('recipes').update({ last_used_at: new Date().toISOString() }).eq('id', recipeId);
}

async function getMealIdsForRecipe(recipeId: string): Promise<string[]> {
  const householdId = await getCurrentHouseholdId();
  const { data, error } = await supabase
    .from('meals')
    .select('id')
    .eq('household_id', householdId)
    .eq('recipe_id', recipeId);
  if (error) return [];
  return (data ?? []).map((r) => r.id as string);
}

/**
 * List rows from “add recipe to list” use categorize-items `normalized_name`, which may differ from
 * `normalize(recipe_ingredient.name)`. Match either against recipe ingredient names.
 */
async function linkExistingListItemsToMeal(mealId: string, ingredientNames: string[]): Promise<void> {
  const targets = new Set(ingredientNames.map((n) => normalize(String(n ?? ''))).filter(Boolean));
  if (targets.size === 0) return;

  const householdId = await getCurrentHouseholdId();
  const { data, error } = await supabase
    .from('list_items')
    .select('id, linked_meal_ids, normalized_name, name')
    .eq('household_id', householdId);
  if (error || !data?.length) return;

  const updates: Promise<unknown>[] = [];
  for (const row of data) {
    const nn = String(row.normalized_name ?? '');
    const nameNorm = normalize(String(row.name ?? ''));
    let match = false;
    for (const t of targets) {
      if (t && (t === nn || t === nameNorm)) {
        match = true;
        break;
      }
    }
    if (!match) continue;
    const current = Array.isArray(row.linked_meal_ids) ? (row.linked_meal_ids as string[]) : [];
    if (current.includes(mealId)) continue;
    const next = [...current, mealId];
    updates.push(
      Promise.resolve(
        supabase.from('list_items').update({ linked_meal_ids: next }).eq('id', row.id as string)
      )
    );
  }
  if (updates.length) await Promise.all(updates);
}

export async function addRecipeIngredientsToList(
  recipeId: string,
  userId: string,
  scaleFactor?: number,
  categorize?: RecipeListCategorizeContext
): Promise<void> {
  if (!isSyncEnabled()) {
    return local.addRecipeIngredientsToList(recipeId, userId, scaleFactor, categorize);
  }
  const { data: ings } = await supabase
    .from('recipe_ingredients')
    .select('name, quantity_value, quantity_unit')
    .eq('recipe_id', recipeId);

  if (!ings?.length) return;

  const factor = scaleFactor ?? 1;

  const mealIds = await getMealIdsForRecipe(recipeId);

  const items = await buildListInsertsFromRecipeIngredients(
    ings.map((i) => ({
      name: i.name,
      quantity_value: i.quantity_value != null ? Number(i.quantity_value) : null,
      quantity_unit: i.quantity_unit,
    })),
    userId,
    factor,
    categorize,
    mealIds
  );

  await insertListItems(userId, items);
  await supabase.from('recipes').update({ last_used_at: new Date().toISOString() }).eq('id', recipeId);
}

function mapRecipe(row: Record<string, unknown>): Recipe {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    household_id: row.household_id as string | undefined,
    name: row.name as string,
    servings: Number(row.servings) ?? 4,
    total_time_minutes:
      row.total_time_minutes != null ? Number(row.total_time_minutes) : null,
    recipe_url: (row.recipe_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    instructions: (row.instructions as string | null) ?? null,
    is_favorite: row.is_favorite === true,
    category: (row.category as RecipeCategory | null) ?? null,
    last_used_at: (row.last_used_at as string | null) ?? null,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

function mapRecipeIngredient(row: Record<string, unknown>): RecipeIngredient {
  return {
    id: row.id as string,
    recipe_id: row.recipe_id as string,
    name: row.name as string,
    quantity_value: row.quantity_value != null ? Number(row.quantity_value) : null,
    quantity_unit: row.quantity_unit as string | null,
    notes: row.notes as string | null,
  };
}
