/**
 * Max lengths aligned with Postgres CHECK constraints (see supabase/migrations).
 * User-facing strings are truncated before insert/update (no UI changes).
 */

export const MAX_ITEM_NAME = 500;
export const MAX_NORMALIZED_NAME = 500;
export const MAX_CATEGORY = 200;
export const MAX_ITEM_NOTES = 2000;
export const MAX_QUANTITY_UNIT = 32;
export const MAX_BRAND_PREFERENCE = 200;

export const MAX_RECIPE_NAME = 500;
export const MAX_RECIPE_URL = 2048;
export const MAX_RECIPE_NOTES = 5000;
/** Step-by-step instructions (matches recipes_instructions_len). */
export const MAX_RECIPE_INSTRUCTIONS = 20000;
/** Raw pasted recipe text for AI parsing requests. */
export const MAX_RECIPE_AI_INPUT = 12000;
export const MAX_INGREDIENT_NAME = 500;
export const MAX_INGREDIENT_NOTES = 2000;

export const MAX_MEAL_NAME = 500;
export const MAX_MEAL_URL = 2048;
export const MAX_MEAL_NOTES = 5000;
export const MAX_CUSTOM_SLOT_NAME = 100;

export const MAX_STORE_NAME = 200;
export const MAX_STORE_NOTES = 2000;
export const MAX_LOCATION_ADDRESS = 500;
export const MAX_PLACE_ID = 300;

/** user_preferences.payload JSON UTF-8 size (matches migration CHECK). */
export const MAX_USER_PREFERENCES_JSON_BYTES = 65536;

export function clampStr(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

export function clampNullable(value: string | null | undefined, max: number): string | null {
  if (value == null || value === '') return value ?? null;
  return clampStr(String(value), max);
}
