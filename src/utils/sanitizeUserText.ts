import {
  clampNullable,
  clampStr,
  MAX_BRAND_PREFERENCE,
  MAX_CATEGORY,
  MAX_CUSTOM_SLOT_NAME,
  MAX_INGREDIENT_NAME,
  MAX_INGREDIENT_NOTES,
  MAX_ITEM_NAME,
  MAX_ITEM_NOTES,
  MAX_LOCATION_ADDRESS,
  MAX_MEAL_NAME,
  MAX_MEAL_NOTES,
  MAX_MEAL_URL,
  MAX_NORMALIZED_NAME,
  MAX_PLACE_ID,
  MAX_QUANTITY_UNIT,
  MAX_RECIPE_NAME,
  MAX_RECIPE_NOTES,
  MAX_RECIPE_INSTRUCTIONS,
  MAX_RECIPE_URL,
  MAX_STORE_NAME,
  MAX_STORE_NOTES,
} from '../constants/textLimits';
import type {
  AisleEntry,
  ItemPriority,
  MealSlot,
  RecipeCategory,
  StoreType,
  ZoneKey,
} from '../types/models';

export type ListItemInsertSanitize = {
  user_id: string;
  name: string;
  normalized_name: string;
  category: string;
  zone_key: ZoneKey;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
  is_checked: boolean;
  linked_meal_ids: string[];
  brand_preference?: string | null;
  substitute_allowed?: boolean;
  priority?: ItemPriority;
  is_recurring?: boolean;
};

export function sanitizeListItemInsert(i: ListItemInsertSanitize): ListItemInsertSanitize {
  return {
    ...i,
    name: clampStr(i.name, MAX_ITEM_NAME),
    normalized_name: clampStr(i.normalized_name, MAX_NORMALIZED_NAME),
    category: clampStr(i.category, MAX_CATEGORY),
    quantity_unit: clampNullable(i.quantity_unit, MAX_QUANTITY_UNIT),
    notes: clampNullable(i.notes, MAX_ITEM_NOTES),
    brand_preference: clampNullable(i.brand_preference ?? null, MAX_BRAND_PREFERENCE),
  };
}

export type ListItemUpdateSanitize = {
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
};

export function sanitizeListItemUpdate(u: ListItemUpdateSanitize): ListItemUpdateSanitize {
  const out: ListItemUpdateSanitize = { ...u };
  if (u.name !== undefined) out.name = clampStr(u.name, MAX_ITEM_NAME);
  if (u.normalized_name !== undefined) out.normalized_name = clampStr(u.normalized_name, MAX_NORMALIZED_NAME);
  if (u.category !== undefined) out.category = clampStr(u.category, MAX_CATEGORY);
  if (u.quantity_unit !== undefined) out.quantity_unit = clampNullable(u.quantity_unit, MAX_QUANTITY_UNIT);
  if (u.notes !== undefined) out.notes = clampNullable(u.notes, MAX_ITEM_NOTES);
  if (u.brand_preference !== undefined) out.brand_preference = clampNullable(u.brand_preference, MAX_BRAND_PREFERENCE);
  return out;
}

function clampRecipeTimeMinutes(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  const n = Math.floor(Number(v));
  if (n < 0 || n > 10080) return null;
  return n;
}

export function sanitizeRecipeCreate(data: {
  name: string;
  servings: number;
  category?: RecipeCategory | null;
  recipe_url?: string | null;
  notes?: string | null;
  instructions?: string | null;
  total_time_minutes?: number | null;
}) {
  return {
    ...data,
    name: clampStr(data.name, MAX_RECIPE_NAME),
    recipe_url: clampNullable(data.recipe_url, MAX_RECIPE_URL),
    notes: clampNullable(data.notes, MAX_RECIPE_NOTES),
    instructions: clampNullable(data.instructions, MAX_RECIPE_INSTRUCTIONS),
    total_time_minutes:
      data.total_time_minutes === undefined
        ? undefined
        : clampRecipeTimeMinutes(data.total_time_minutes),
  };
}

export function sanitizeRecipeUpdate(data: {
  name: string;
  servings: number;
  category?: RecipeCategory | null;
  recipe_url?: string | null;
  notes?: string | null;
  instructions?: string | null;
  total_time_minutes?: number | null;
}) {
  return sanitizeRecipeCreate(data);
}

export function sanitizeRecipeIngredientInput(i: {
  name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
}) {
  return {
    ...i,
    name: clampStr(i.name, MAX_INGREDIENT_NAME),
    quantity_unit: clampNullable(i.quantity_unit, MAX_QUANTITY_UNIT),
    notes: clampNullable(i.notes, MAX_INGREDIENT_NOTES),
  };
}

export function sanitizeMealCreate(data: {
  name: string;
  meal_date: string;
  meal_slot: MealSlot;
  custom_slot_name?: string | null;
  recipe_id?: string | null;
  recipe_url?: string | null;
  notes?: string | null;
}) {
  return {
    ...data,
    name: clampStr(data.name, MAX_MEAL_NAME),
    custom_slot_name:
      data.custom_slot_name != null && data.custom_slot_name !== ''
        ? clampStr(data.custom_slot_name, MAX_CUSTOM_SLOT_NAME)
        : data.custom_slot_name,
    recipe_url: clampNullable(data.recipe_url, MAX_MEAL_URL),
    notes: clampNullable(data.notes, MAX_MEAL_NOTES),
  };
}

export function sanitizeMealUpdate(data: {
  name?: string;
  meal_date?: string;
  meal_slot?: MealSlot;
  custom_slot_name?: string | null;
  recipe_url?: string | null;
  notes?: string | null;
}) {
  const out = { ...data };
  if (data.name != null) out.name = clampStr(data.name, MAX_MEAL_NAME);
  if (data.custom_slot_name != null && data.custom_slot_name !== '') {
    out.custom_slot_name = clampStr(data.custom_slot_name, MAX_CUSTOM_SLOT_NAME);
  }
  if (data.recipe_url !== undefined) out.recipe_url = clampNullable(data.recipe_url, MAX_MEAL_URL);
  if (data.notes !== undefined) out.notes = clampNullable(data.notes, MAX_MEAL_NOTES);
  return out;
}

export function sanitizeMealIngredientInput(i: {
  name: string;
  normalized_name?: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes?: string | null;
  brand_preference?: string | null;
}) {
  return {
    ...i,
    name: clampStr(i.name, MAX_INGREDIENT_NAME),
    normalized_name:
      i.normalized_name !== undefined ? clampStr(i.normalized_name, MAX_NORMALIZED_NAME) : i.normalized_name,
    quantity_unit: clampNullable(i.quantity_unit, MAX_QUANTITY_UNIT),
    notes: clampNullable(i.notes ?? null, MAX_INGREDIENT_NOTES),
    brand_preference: clampNullable(i.brand_preference ?? null, MAX_BRAND_PREFERENCE),
  };
}

export function sanitizeCreateStore(data: {
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
}) {
  return {
    ...data,
    name: clampStr(data.name, MAX_STORE_NAME),
    notes: clampNullable(data.notes ?? null, MAX_STORE_NOTES),
    location_address: clampNullable(data.location_address ?? null, MAX_LOCATION_ADDRESS),
    place_id: clampNullable(data.place_id ?? null, MAX_PLACE_ID),
  };
}

export function sanitizeUpdateStore(updates: {
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
}) {
  const out = { ...updates };
  if (updates.name != null) out.name = clampStr(updates.name, MAX_STORE_NAME);
  if (updates.notes !== undefined) out.notes = clampNullable(updates.notes, MAX_STORE_NOTES);
  if (updates.location_address !== undefined) {
    out.location_address = clampNullable(updates.location_address, MAX_LOCATION_ADDRESS);
  }
  if (updates.place_id !== undefined) out.place_id = clampNullable(updates.place_id, MAX_PLACE_ID);
  return out;
}

/** "Copy of " prefix + original name, total capped at MAX_RECIPE_NAME */
export function sanitizeDuplicateRecipeName(originalName: string): string {
  const prefix = 'Copy of ';
  const room = Math.max(0, MAX_RECIPE_NAME - prefix.length);
  return prefix + clampStr(originalName, room);
}
