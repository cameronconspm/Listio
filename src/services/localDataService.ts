/**
 * Local AsyncStorage-backed data layer used when Supabase sync is disabled.
 * Mirrors the public API of listService, mealService, recipeService, storeService.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_HOUSEHOLD_ID } from './householdService';
import { normalize } from '../utils/normalize';
import {
  buildListInsertsFromRecipeIngredients,
  type RecipeListCategorizeContext,
} from '../utils/buildListInsertsFromRecipeIngredients';
import { ZONE_KEYS } from '../data/zone';
import { zoneOrderToAisleOrder } from '../utils/storeUtils';
import {
  sanitizeCreateStore,
  sanitizeDuplicateRecipeName,
  sanitizeListItemInsert,
  sanitizeListItemUpdate,
  sanitizeMealCreate,
  sanitizeMealIngredientInput,
  sanitizeMealUpdate,
  sanitizeRecipeCreate,
  sanitizeRecipeIngredientInput,
  sanitizeRecipeUpdate,
  sanitizeUpdateStore,
} from '../utils/sanitizeUserText';
import type {
  ListItem,
  ItemPriority,
  ZoneKey,
  Meal,
  MealIngredient,
  MealSlot,
  Recipe,
  RecipeIngredient,
  StoreProfile,
  StoreType,
  AisleEntry,
} from '../types/models';

// Inline types to avoid circular imports with listService/mealService/recipeService
interface ListItemInsert {
  user_id: string;
  name: string;
  normalized_name: string;
  category?: string;
  zone_key: ZoneKey;
  quantity_value?: number | null;
  quantity_unit?: string | null;
  notes?: string | null;
  is_checked?: boolean;
  linked_meal_ids?: string[];
  brand_preference?: string | null;
  substitute_allowed?: boolean;
  priority?: ItemPriority;
  is_recurring?: boolean;
}

interface ListItemUpdate {
  name?: string;
  normalized_name?: string;
  category?: string;
  zone_key?: ZoneKey;
  quantity_value?: number | null;
  quantity_unit?: string | null;
  notes?: string | null;
  brand_preference?: string | null;
  substitute_allowed?: boolean;
  priority?: ItemPriority;
  is_recurring?: boolean;
}

interface CreateMealInput {
  name: string;
  meal_date: string;
  meal_slot?: MealSlot;
  custom_slot_name?: string | null;
  recipe_id?: string | null;
  recipe_url?: string | null;
  notes?: string | null;
}

interface UpdateMealInput {
  name?: string;
  meal_date?: string;
  meal_slot?: MealSlot;
  custom_slot_name?: string | null;
  recipe_url?: string | null;
  notes?: string | null;
}

interface MealIngredientInput {
  name: string;
  normalized_name?: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes?: string | null;
  brand_preference?: string | null;
}

interface MealWithIngredients {
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
}

interface RecipeIngredientInput {
  name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
}

const KEYS = {
  list_items: '@listio/local/list_items',
  meals: '@listio/local/meals',
  meal_ingredients: '@listio/local/meal_ingredients',
  recipes: '@listio/local/recipes',
  recipe_ingredients: '@listio/local/recipe_ingredients',
  store_profiles: '@listio/local/store_profiles',
};

const DEFAULT_ZONE_ORDER: ZoneKey[] = [...ZONE_KEYS];

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    (Math.random() * 16 | 0).toString(16)
  );
}

function now(): string {
  return new Date().toISOString();
}

// --- List items ---
async function loadListItems(): Promise<ListItem[]> {
  const raw = await AsyncStorage.getItem(KEYS.list_items);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function saveListItems(items: ListItem[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.list_items, JSON.stringify(items));
}

function inLocalHousehold<T extends { household_id?: string }>(row: T): boolean {
  return !row.household_id || row.household_id === LOCAL_HOUSEHOLD_ID;
}

export async function fetchListItems(userId: string): Promise<ListItem[]> {
  const items = await loadListItems();
  return items
    .filter((i) => i.user_id === userId && inLocalHousehold(i))
    .map((i) => (typeof i.is_checked === 'boolean' ? i : { ...i, is_checked: Boolean(i.is_checked) }))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
}

export async function toggleChecked(id: string, is_checked: boolean): Promise<void> {
  const items = await loadListItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], is_checked, updated_at: now() };
  await saveListItems(items);
}

export async function deleteListItem(id: string): Promise<void> {
  const items = await loadListItems();
  await saveListItems(items.filter((i) => i.id !== id));
}

export async function deleteAllListItems(userId: string): Promise<void> {
  const items = await loadListItems();
  await saveListItems(items.filter((i) => !(i.user_id === userId && inLocalHousehold(i))));
}

export async function deleteListItemsInZone(userId: string, zoneKey: ZoneKey): Promise<void> {
  const items = await loadListItems();
  await saveListItems(
    items.filter((i) => !(i.user_id === userId && inLocalHousehold(i) && i.zone_key === zoneKey))
  );
}

export async function updateListItem(id: string, updates: ListItemUpdate): Promise<void> {
  const safe = sanitizeListItemUpdate(updates);
  const items = await loadListItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error('Item not found');
  const cur = items[idx];
  const next: ListItem = {
    ...cur,
    ...(safe.name != null && { name: safe.name }),
    ...(safe.normalized_name != null && { normalized_name: safe.normalized_name }),
    ...(safe.category != null && { category: safe.category }),
    ...(safe.zone_key != null && { zone_key: safe.zone_key }),
    ...(safe.quantity_value !== undefined && { quantity_value: safe.quantity_value }),
    ...(safe.quantity_unit != null && { quantity_unit: safe.quantity_unit }),
    ...(safe.notes != null && { notes: safe.notes }),
    ...(safe.brand_preference !== undefined && { brand_preference: safe.brand_preference }),
    ...(safe.substitute_allowed !== undefined && { substitute_allowed: safe.substitute_allowed }),
    ...(safe.priority != null && { priority: safe.priority }),
    ...(safe.is_recurring !== undefined && { is_recurring: safe.is_recurring }),
    updated_at: now(),
  };
  items[idx] = next;
  await saveListItems(items);
}

export async function insertListItems(userId: string, items: ListItemInsert[]): Promise<ListItem[]> {
  if (items.length === 0) return [];
  const all = await loadListItems();
  const ts = now();
  const inserted: ListItem[] = [];
  for (const raw of items) {
    const i = sanitizeListItemInsert({
      user_id: raw.user_id,
      name: raw.name,
      normalized_name: raw.normalized_name,
      category: raw.category ?? '',
      zone_key: raw.zone_key,
      quantity_value: raw.quantity_value ?? null,
      quantity_unit: raw.quantity_unit ?? null,
      notes: raw.notes ?? null,
      is_checked: raw.is_checked ?? false,
      linked_meal_ids: raw.linked_meal_ids ?? [],
      brand_preference: raw.brand_preference,
      substitute_allowed: raw.substitute_allowed,
      priority: raw.priority,
      is_recurring: raw.is_recurring,
    });
    const row: ListItem = {
      id: uuid(),
      user_id: i.user_id,
      household_id: LOCAL_HOUSEHOLD_ID,
      name: i.name,
      normalized_name: i.normalized_name,
      category: i.category ?? '',
      zone_key: i.zone_key,
      quantity_value: i.quantity_value ?? null,
      quantity_unit: i.quantity_unit ?? null,
      notes: i.notes ?? null,
      is_checked: i.is_checked ?? false,
      linked_meal_ids: i.linked_meal_ids ?? [],
      brand_preference: i.brand_preference ?? null,
      substitute_allowed: i.substitute_allowed ?? true,
      priority: (i.priority as ItemPriority) ?? 'normal',
      is_recurring: i.is_recurring ?? false,
      created_at: ts,
      updated_at: ts,
    };
    inserted.push(row);
    all.push(row);
  }
  await saveListItems(all);
  return inserted;
}

// --- Meals ---
async function loadMeals(): Promise<Meal[]> {
  const raw = await AsyncStorage.getItem(KEYS.meals);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function saveMeals(meals: Meal[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.meals, JSON.stringify(meals));
}

async function loadMealIngredients(): Promise<MealIngredient[]> {
  const raw = await AsyncStorage.getItem(KEYS.meal_ingredients);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function saveMealIngredients(ings: MealIngredient[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.meal_ingredients, JSON.stringify(ings));
}

export async function getMeals(userId: string): Promise<Meal[]> {
  const meals = await loadMeals();
  return meals
    .filter((m) => m.user_id === userId && inLocalHousehold(m))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function getMealsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Meal[]> {
  const meals = await loadMeals();
  return meals
    .filter(
      (m) =>
        m.user_id === userId &&
        inLocalHousehold(m) &&
        m.meal_date >= startDate &&
        m.meal_date <= endDate
    )
    .sort((a, b) => {
      const d = (a.meal_date || '').localeCompare(b.meal_date || '');
      return d !== 0 ? d : (a.created_at || '').localeCompare(b.created_at || '');
    });
}

export async function getMealWithIngredients(mealId: string): Promise<MealWithIngredients> {
  const meals = await loadMeals();
  const meal = meals.find((m) => m.id === mealId);
  if (!meal) throw new Error('Meal not found');

  const allIngs = await loadMealIngredients();
  const ings = allIngs
    .filter((i) => i.meal_id === mealId)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    meal: {
      id: meal.id,
      name: meal.name,
      meal_date: meal.meal_date ?? '',
      meal_slot: (meal.meal_slot as MealSlot) ?? 'dinner',
      custom_slot_name: meal.custom_slot_name ?? null,
      recipe_url: meal.recipe_url ?? null,
      notes: meal.notes ?? null,
    },
    ingredients: ings,
  };
}

export async function createMeal(userId: string, data: CreateMealInput): Promise<Meal> {
  const d = sanitizeMealCreate({
    name: data.name,
    meal_date: data.meal_date,
    meal_slot: data.meal_slot ?? 'dinner',
    custom_slot_name: data.custom_slot_name,
    recipe_id: data.recipe_id,
    recipe_url: data.recipe_url,
    notes: data.notes,
  });
  const meals = await loadMeals();
  const ts = now();
  const meal: Meal = {
    id: uuid(),
    user_id: userId,
    household_id: LOCAL_HOUSEHOLD_ID,
    name: d.name,
    recipe_id: d.recipe_id ?? null,
    start_date: null,
    end_date: null,
    meal_date: d.meal_date,
    meal_slot: d.meal_slot,
    custom_slot_name: d.custom_slot_name ?? null,
    recipe_url: d.recipe_url ?? null,
    notes: d.notes ?? null,
    created_at: ts,
    updated_at: ts,
  };
  meals.push(meal);
  await saveMeals(meals);
  return meal;
}

export async function updateMeal(mealId: string, data: UpdateMealInput): Promise<void> {
  const meals = await loadMeals();
  const idx = meals.findIndex((m) => m.id === mealId);
  if (idx === -1) return;
  const cur = meals[idx];
  const safe = sanitizeMealUpdate(data);
  meals[idx] = {
    ...cur,
    ...(safe.name != null && { name: safe.name }),
    ...(safe.meal_date !== undefined && { meal_date: safe.meal_date }),
    ...(safe.meal_slot !== undefined && { meal_slot: safe.meal_slot }),
    ...(safe.custom_slot_name != null && { custom_slot_name: safe.custom_slot_name }),
    ...(safe.recipe_url !== undefined && { recipe_url: safe.recipe_url }),
    ...(safe.notes !== undefined && { notes: safe.notes }),
    updated_at: now(),
  };
  await saveMeals(meals);
}

export async function deleteMeal(mealId: string): Promise<void> {
  const meals = await loadMeals();
  await saveMeals(meals.filter((m) => m.id !== mealId));
  const ings = await loadMealIngredients();
  await saveMealIngredients(ings.filter((i) => i.meal_id !== mealId));
}

export async function setMealIngredients(
  mealId: string,
  ingredients: MealIngredientInput[]
): Promise<void> {
  let ings = await loadMealIngredients();
  ings = ings.filter((i) => i.meal_id !== mealId);
  for (const raw of ingredients) {
    const i = sanitizeMealIngredientInput(raw);
    ings.push({
      id: uuid(),
      meal_id: mealId,
      name: i.name,
      normalized_name: i.normalized_name ?? normalize(i.name),
      quantity_value: i.quantity_value,
      quantity_unit: i.quantity_unit,
      notes: i.notes ?? null,
      brand_preference: i.brand_preference ?? null,
    });
  }
  await saveMealIngredients(ings);
}

export async function getMealsByIds(mealIds: string[]): Promise<Meal[]> {
  if (mealIds.length === 0) return [];
  const meals = await loadMeals();
  const set = new Set(mealIds);
  return meals.filter((m) => set.has(m.id));
}

export async function getMealIngredientCounts(mealIds: string[]): Promise<Map<string, number>> {
  if (mealIds.length === 0) return new Map();
  const ings = await loadMealIngredients();
  const set = new Set(mealIds);
  const counts = new Map<string, number>();
  for (const i of ings) {
    if (set.has(i.meal_id)) {
      counts.set(i.meal_id, (counts.get(i.meal_id) ?? 0) + 1);
    }
  }
  return counts;
}

export async function copyMealToDates(
  mealId: string,
  userId: string,
  targetDates: string[]
): Promise<{ created: number }> {
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
  const ings = await loadMealIngredients();
  const mealIngs = ings.filter((i) => i.meal_id === mealId);
  if (mealIngs.length === 0) return;

  const existingList = await fetchListItems(userId);
  const existingNormalized = new Set(existingList.map((i) => i.normalized_name));

  const missing = mealIngs.filter(
    (i) => !existingNormalized.has(i.normalized_name || normalize(i.name))
  );
  if (missing.length === 0) return;

  const items: ListItemInsert[] = missing.map((i) => ({
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

// --- Recipes ---
async function loadRecipes(): Promise<Recipe[]> {
  const raw = await AsyncStorage.getItem(KEYS.recipes);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function saveRecipes(recipes: Recipe[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.recipes, JSON.stringify(recipes));
}

async function loadRecipeIngredients(): Promise<RecipeIngredient[]> {
  const raw = await AsyncStorage.getItem(KEYS.recipe_ingredients);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function saveRecipeIngredients(ings: RecipeIngredient[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.recipe_ingredients, JSON.stringify(ings));
}

type RecipeFilter = 'all' | 'favorites' | import('../types/models').RecipeCategory | 'recent';
type RecipeSortKey = 'updated_at' | 'created_at' | 'name' | 'servings' | 'ingredient_count';

export type GetRecipesOptions = {
  filter?: RecipeFilter;
  sort?: RecipeSortKey;
};

export async function getRecipes(userId: string, options?: GetRecipesOptions): Promise<Recipe[]> {
  const recipes = await loadRecipes();
  let filtered = recipes.filter((r) => r.user_id === userId && inLocalHousehold(r));

  const filter = options?.filter ?? 'all';
  if (filter === 'favorites') {
    filtered = filtered.filter((r) => r.is_favorite === true);
  } else if (filter !== 'all' && filter !== 'recent') {
    filtered = filtered.filter((r) => r.category === filter);
  }

  const sort = options?.sort ?? 'updated_at';
  if (filter === 'recent') {
    filtered = [...filtered].sort((a, b) => {
      const aDate = a.last_used_at || a.updated_at || a.created_at || '';
      const bDate = b.last_used_at || b.updated_at || b.created_at || '';
      return bDate.localeCompare(aDate);
    });
  } else if (sort === 'updated_at') {
    filtered = [...filtered].sort(
      (a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')
    );
  } else if (sort === 'created_at') {
    filtered = [...filtered].sort(
      (a, b) => (b.created_at || '').localeCompare(a.created_at || '')
    );
  } else if (sort === 'name') {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'servings') {
    filtered = [...filtered].sort((a, b) => (a.servings ?? 0) - (b.servings ?? 0));
  } else if (sort === 'ingredient_count') {
    const ings = await loadRecipeIngredients();
    const counts = new Map<string, number>();
    for (const i of ings) {
      counts.set(i.recipe_id, (counts.get(i.recipe_id) ?? 0) + 1);
    }
    filtered = [...filtered].sort(
      (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
    );
  }

  return filtered;
}

export async function toggleRecipeFavorite(recipeId: string): Promise<void> {
  const recipes = await loadRecipes();
  const idx = recipes.findIndex((r) => r.id === recipeId);
  if (idx === -1) return;
  recipes[idx] = {
    ...recipes[idx],
    is_favorite: !(recipes[idx].is_favorite ?? false),
    updated_at: now(),
  };
  await saveRecipes(recipes);
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
    category?: Recipe['category'];
  };
  ingredients: RecipeIngredient[];
}> {
  const recipes = await loadRecipes();
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) throw new Error('Recipe not found');

  const allIngs = await loadRecipeIngredients();
  const ings = allIngs
    .filter((i) => i.recipe_id === recipeId)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    recipe: {
      id: recipe.id,
      name: recipe.name,
      servings: recipe.servings ?? 4,
      total_time_minutes: recipe.total_time_minutes ?? null,
      recipe_url: recipe.recipe_url ?? null,
      notes: recipe.notes ?? null,
      instructions: recipe.instructions ?? null,
      is_favorite: recipe.is_favorite ?? false,
      category: recipe.category ?? null,
    },
    ingredients: ings,
  };
}

export async function createRecipe(
  userId: string,
  data: {
    name: string;
    servings: number;
    category?: import('../types/models').RecipeCategory | null;
    recipe_url?: string | null;
    notes?: string | null;
    instructions?: string | null;
    total_time_minutes?: number | null;
  }
): Promise<Recipe> {
  const d = sanitizeRecipeCreate(data);
  const recipes = await loadRecipes();
  const ts = now();
  const recipe: Recipe = {
    id: uuid(),
    user_id: userId,
    household_id: LOCAL_HOUSEHOLD_ID,
    name: d.name,
    servings: d.servings ?? 4,
    total_time_minutes: d.total_time_minutes ?? null,
    recipe_url: d.recipe_url ?? null,
    notes: d.notes ?? null,
    instructions: d.instructions?.trim() ? d.instructions.trim() : null,
    is_favorite: false,
    category: d.category ?? null,
    created_at: ts,
    updated_at: ts,
  };
  recipes.push(recipe);
  await saveRecipes(recipes);
  return recipe;
}

export async function updateRecipe(
  recipeId: string,
  data: {
    name: string;
    servings: number;
    category?: import('../types/models').RecipeCategory | null;
    recipe_url?: string | null;
    notes?: string | null;
    instructions?: string | null;
    total_time_minutes?: number | null;
  }
): Promise<void> {
  const d = sanitizeRecipeUpdate(data);
  const recipes = await loadRecipes();
  const idx = recipes.findIndex((r) => r.id === recipeId);
  if (idx === -1) return;
  const nextInstructions =
    d.instructions !== undefined
      ? d.instructions?.trim()
        ? d.instructions
        : null
      : recipes[idx].instructions;
  recipes[idx] = {
    ...recipes[idx],
    name: d.name,
    servings: d.servings,
    category: d.category !== undefined ? d.category : recipes[idx].category,
    recipe_url: d.recipe_url !== undefined ? d.recipe_url : recipes[idx].recipe_url,
    notes: d.notes !== undefined ? d.notes : recipes[idx].notes,
    instructions: nextInstructions,
    total_time_minutes:
      d.total_time_minutes !== undefined ? d.total_time_minutes : recipes[idx].total_time_minutes,
    updated_at: now(),
  };
  await saveRecipes(recipes);
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const recipes = await loadRecipes();
  await saveRecipes(recipes.filter((r) => r.id !== recipeId));
  const ings = await loadRecipeIngredients();
  await saveRecipeIngredients(ings.filter((i) => i.recipe_id !== recipeId));
}

export async function duplicateRecipe(recipeId: string, userId: string): Promise<Recipe> {
  const recipes = await loadRecipes();
  const orig = recipes.find((r) => r.id === recipeId);
  if (!orig) throw new Error('Recipe not found');

  const ings = await loadRecipeIngredients();
  const origIngs = ings.filter((i) => i.recipe_id === recipeId);

  const ts = now();
  const newRecipe: Recipe = {
    id: uuid(),
    user_id: userId,
    household_id: orig.household_id ?? LOCAL_HOUSEHOLD_ID,
    name: sanitizeDuplicateRecipeName(orig.name),
    servings: orig.servings ?? 4,
    total_time_minutes: orig.total_time_minutes ?? null,
    recipe_url: orig.recipe_url ?? null,
    notes: orig.notes ?? null,
    instructions: orig.instructions ?? null,
    is_favorite: false,
    category: orig.category ?? null,
    created_at: ts,
    updated_at: ts,
  };
  recipes.push(newRecipe);
  await saveRecipes(recipes);

  const newIngs = origIngs.map((raw) => {
    const i = sanitizeRecipeIngredientInput({
      name: raw.name,
      quantity_value: raw.quantity_value,
      quantity_unit: raw.quantity_unit,
      notes: raw.notes ?? null,
    });
    return {
    id: uuid(),
    recipe_id: newRecipe.id,
    name: i.name,
    quantity_value: i.quantity_value,
    quantity_unit: i.quantity_unit,
    notes: i.notes ?? null,
  };
  });
  const allIngs = await loadRecipeIngredients();
  await saveRecipeIngredients([...allIngs, ...newIngs]);

  return newRecipe;
}

export async function getRecipeIngredientCounts(recipeIds: string[]): Promise<Map<string, number>> {
  if (recipeIds.length === 0) return new Map();
  const ings = await loadRecipeIngredients();
  const set = new Set(recipeIds);
  const counts = new Map<string, number>();
  for (const i of ings) {
    if (set.has(i.recipe_id)) {
      counts.set(i.recipe_id, (counts.get(i.recipe_id) ?? 0) + 1);
    }
  }
  return counts;
}

export async function getRecipeIngredientNamesByRecipeIds(
  recipeIds: string[]
): Promise<Map<string, string[]>> {
  if (recipeIds.length === 0) return new Map();
  const set = new Set(recipeIds);
  const ings = await loadRecipeIngredients();
  const map = new Map<string, string[]>();
  for (const i of ings) {
    if (!set.has(i.recipe_id)) continue;
    if (!map.has(i.recipe_id)) map.set(i.recipe_id, []);
    map.get(i.recipe_id)!.push(i.name);
  }
  return map;
}

export async function setRecipeIngredients(
  recipeId: string,
  ingredients: RecipeIngredientInput[]
): Promise<void> {
  let ings = await loadRecipeIngredients();
  ings = ings.filter((i) => i.recipe_id !== recipeId);
  for (const raw of ingredients) {
    const i = sanitizeRecipeIngredientInput(raw);
    ings.push({
      id: uuid(),
      recipe_id: recipeId,
      name: i.name,
      quantity_value: i.quantity_value,
      quantity_unit: i.quantity_unit,
      notes: i.notes ?? null,
    });
  }
  await saveRecipeIngredients(ings);
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
  const recipes = await loadRecipes();
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) throw new Error('Recipe not found');

  const created = await createMeal(userId, {
    name: recipe.name,
    meal_date: meal.meal_date,
    meal_slot: meal.meal_slot,
    custom_slot_name: meal.meal_slot === 'custom' ? meal.custom_slot_name ?? null : null,
    recipe_id: recipeId,
    recipe_url: null,
    notes: null,
  });

  const allRecipeIngs = await loadRecipeIngredients();
  const recipeIngs = allRecipeIngs.filter((i) => i.recipe_id === recipeId);
  if (recipeIngs.length > 0) {
    await setMealIngredients(
      created.id,
      recipeIngs.map((i) => ({
        name: i.name,
        quantity_value: i.quantity_value,
        quantity_unit: i.quantity_unit,
        notes: i.notes ?? null,
        brand_preference: null,
      }))
    );
    await linkLocalListItemsToMeal(
      created.id,
      recipeIngs.map((i) => i.name)
    );
  }

  const recs = await loadRecipes();
  const recIdx = recs.findIndex((r) => r.id === recipeId);
  if (recIdx >= 0) {
    recs[recIdx] = { ...recs[recIdx], last_used_at: now(), updated_at: now() };
    await saveRecipes(recs);
  }
}

async function getLocalMealIdsForRecipe(recipeId: string): Promise<string[]> {
  const meals = await loadMeals();
  return meals.filter((m) => m.recipe_id === recipeId).map((m) => m.id);
}

async function linkLocalListItemsToMeal(mealId: string, ingredientNames: string[]): Promise<void> {
  const targets = new Set(ingredientNames.map((n) => normalize(String(n ?? ''))).filter(Boolean));
  if (targets.size === 0) return;

  const items = await loadListItems();
  let changed = false;
  const next = items.map((item) => {
    const nn = item.normalized_name;
    const nameNorm = normalize(item.name);
    const match = [...targets].some((t) => t && (t === nn || t === nameNorm));
    if (!match) return item;
    const current = item.linked_meal_ids ?? [];
    if (current.includes(mealId)) return item;
    changed = true;
    return { ...item, linked_meal_ids: [...current, mealId], updated_at: now() };
  });
  if (changed) {
    await saveListItems(next);
  }
}

export async function addRecipeIngredientsToList(
  recipeId: string,
  userId: string,
  scaleFactor?: number,
  categorize?: RecipeListCategorizeContext
): Promise<void> {
  const ings = await loadRecipeIngredients();
  const recipeIngs = ings.filter((i) => i.recipe_id === recipeId);
  if (recipeIngs.length === 0) return;

  const factor = scaleFactor ?? 1;

  const mealIds = await getLocalMealIdsForRecipe(recipeId);

  const items = await buildListInsertsFromRecipeIngredients(
    recipeIngs.map((i) => ({
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

  const recs = await loadRecipes();
  const recIdx = recs.findIndex((r) => r.id === recipeId);
  if (recIdx >= 0) {
    recs[recIdx] = { ...recs[recIdx], last_used_at: now(), updated_at: now() };
    await saveRecipes(recs);
  }
}

// --- Store profiles ---
async function loadStoreProfiles(): Promise<StoreProfile[]> {
  const raw = await AsyncStorage.getItem(KEYS.store_profiles);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function saveStoreProfiles(stores: StoreProfile[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.store_profiles, JSON.stringify(stores));
}

export async function ensureDefaultStore(_userId: string): Promise<void> {
  /* no-op: first store is created explicitly via add-store with a maps place */
}

export async function getDefaultStore(userId: string): Promise<StoreProfile | null> {
  const stores = await loadStoreProfiles();
  return stores.find((s) => s.user_id === userId && s.is_default && inLocalHousehold(s)) ?? null;
}

export async function getStores(userId: string): Promise<StoreProfile[]> {
  const stores = await loadStoreProfiles();
  return stores
    .filter((s) => s.user_id === userId && inLocalHousehold(s))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
}

export async function createStore(
  userId: string,
  data: {
    name: string;
    store_type?: StoreType;
    zone_order?: ZoneKey[];
    aisle_order?: AisleEntry[];
    notes?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    location_address?: string | null;
    place_id?: string | null;
    place_provider?: 'google' | null;
  }
): Promise<StoreProfile> {
  const d = sanitizeCreateStore(data);
  const stores = await loadStoreProfiles();
  const userStores = stores.filter((s) => s.user_id === userId && inLocalHousehold(s));
  const makeDefault = userStores.length === 0;
  const ts = now();
  const zoneOrder = d.zone_order ?? DEFAULT_ZONE_ORDER;
  const aisleOrder = d.aisle_order ?? zoneOrder.map((key) => ({ type: 'builtin' as const, key }));
  const store: StoreProfile = {
    id: uuid(),
    user_id: userId,
    household_id: LOCAL_HOUSEHOLD_ID,
    name: d.name || 'My Store',
    latitude: d.latitude !== undefined ? d.latitude : null,
    longitude: d.longitude !== undefined ? d.longitude : null,
    location_address: d.location_address !== undefined ? d.location_address : null,
    place_id: d.place_id !== undefined ? d.place_id : null,
    place_provider: d.place_provider !== undefined ? d.place_provider : null,
    store_type: d.store_type ?? 'generic',
    zone_order: zoneOrder,
    aisle_order: aisleOrder,
    notes: d.notes ?? null,
    is_default: makeDefault,
    created_at: ts,
    updated_at: ts,
  };
  stores.push(store);
  await saveStoreProfiles(stores);
  return store;
}

export async function setDefaultStore(userId: string, storeId: string): Promise<void> {
  const stores = await loadStoreProfiles();
  for (let i = 0; i < stores.length; i++) {
    if (stores[i].user_id === userId && inLocalHousehold(stores[i])) {
      stores[i] = { ...stores[i], is_default: stores[i].id === storeId };
    }
  }
  await saveStoreProfiles(stores);
}

export async function updateStoreProfile(
  storeId: string,
  updates: {
    store_type?: StoreType;
    zone_order?: ZoneKey[];
    aisle_order?: AisleEntry[];
    name?: string;
    notes?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    location_address?: string | null;
    place_id?: string | null;
    place_provider?: 'google' | null;
  }
): Promise<void> {
  const safe = sanitizeUpdateStore(updates);
  const stores = await loadStoreProfiles();
  const idx = stores.findIndex((s) => s.id === storeId);
  if (idx === -1) return;
  const cur = stores[idx];
  let nextZoneOrder = cur.zone_order;
  let nextAisleOrder = cur.aisle_order;
  if (safe.zone_order != null) {
    nextZoneOrder = safe.zone_order;
    nextAisleOrder = zoneOrderToAisleOrder(safe.zone_order);
  } else if (safe.aisle_order != null) {
    nextAisleOrder = safe.aisle_order;
    nextZoneOrder = safe.aisle_order
      .filter((e): e is AisleEntry & { type: 'builtin' } => e.type === 'builtin')
      .map((e) => e.key);
  }

  stores[idx] = {
    ...cur,
    ...(safe.store_type != null && { store_type: safe.store_type }),
    ...(safe.zone_order != null && { zone_order: nextZoneOrder, aisle_order: nextAisleOrder }),
    ...(safe.aisle_order != null && { aisle_order: nextAisleOrder, zone_order: nextZoneOrder }),
    ...(safe.name != null && { name: safe.name }),
    ...(safe.notes !== undefined && { notes: safe.notes }),
    ...(safe.latitude !== undefined && { latitude: safe.latitude }),
    ...(safe.longitude !== undefined && { longitude: safe.longitude }),
    ...(safe.location_address !== undefined && { location_address: safe.location_address }),
    ...(safe.place_id !== undefined && { place_id: safe.place_id }),
    ...(safe.place_provider !== undefined && { place_provider: safe.place_provider }),
    updated_at: now(),
  };
  await saveStoreProfiles(stores);
}

export async function deleteStore(userId: string, storeId: string): Promise<void> {
  const stores = await loadStoreProfiles();
  const store = stores.find((s) => s.id === storeId && s.user_id === userId && inLocalHousehold(s));
  if (!store) return;

  let remaining = stores.filter((s) => s.id !== storeId);
  if (store.is_default) {
    const userStores = remaining.filter((s) => s.user_id === userId && inLocalHousehold(s));
    const next = userStores[0];
    if (next) {
      remaining = remaining.map((s) =>
        s.user_id === userId && inLocalHousehold(s) ? { ...s, is_default: s.id === next.id } : s
      );
    }
  }
  await saveStoreProfiles(remaining);
}

/** Snapshot of local AsyncStorage rows for one user (used for local → cloud import). */
export async function snapshotLocalDataForUser(userId: string): Promise<{
  listItems: ListItem[];
  meals: Meal[];
  mealIngredients: MealIngredient[];
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  storeProfiles: StoreProfile[];
}> {
  const [listItems, meals, mealIngredients, recipes, recipeIngredients, storeProfiles] =
    await Promise.all([
      loadListItems(),
      loadMeals(),
      loadMealIngredients(),
      loadRecipes(),
      loadRecipeIngredients(),
      loadStoreProfiles(),
    ]);

  const userMeals = meals.filter((m) => m.user_id === userId && inLocalHousehold(m));
  const mealIdSet = new Set(userMeals.map((m) => m.id));
  const userRecipes = recipes.filter((r) => r.user_id === userId && inLocalHousehold(r));
  const recipeIdSet = new Set(userRecipes.map((r) => r.id));

  return {
    listItems: listItems.filter((i) => i.user_id === userId && inLocalHousehold(i)),
    meals: userMeals,
    mealIngredients: mealIngredients.filter((i) => mealIdSet.has(i.meal_id)),
    recipes: userRecipes,
    recipeIngredients: recipeIngredients.filter((i) => recipeIdSet.has(i.recipe_id)),
    storeProfiles: storeProfiles.filter((s) => s.user_id === userId && inLocalHousehold(s)),
  };
}

/** Clears all local data (list items, meals, recipes, store profiles). For testing only. */
export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
