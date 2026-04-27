// Shared model types – aligned with Supabase schema

export type ZoneKey =
  | 'produce'
  | 'bakery_deli'
  | 'meat_seafood'
  | 'dairy_eggs'
  | 'frozen'
  | 'pantry'
  | 'snacks_drinks'
  | 'household_cleaning'
  | 'personal_care'
  | 'other';

/** Store layout row: built-in section (zone key) or custom section name */
export type AisleEntry =
  | { type: 'builtin'; key: ZoneKey; icon?: string }
  | { type: 'custom'; id: string; name: string; icon?: string };

export type StoreType =
  | 'generic'
  | 'kroger_style'
  | 'albertsons_style'
  | 'wholefoods_style'
  | 'costco_style'
  | 'traderjoes_style';

export interface Profile {
  id: string;
  created_at: string;
}

export interface StoreProfile {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  /** WGS84; set from device when user saves "store location" for nearest-store hints */
  latitude?: number | null;
  longitude?: number | null;
  /** Optional display line from address search or reverse geocode */
  location_address?: string | null;
  /** Google Places place_id when linked to a POI (dedupe nearby / add flow) */
  place_id?: string | null;
  /** Maps provider for place_id */
  place_provider?: 'google' | null;
  store_type: StoreType;
  /** Legacy: used when aisle_order is empty. Prefer aisle_order. */
  zone_order: ZoneKey[];
  /** Ordered sections (built-in + custom). When set, supersedes zone_order. */
  aisle_order?: AisleEntry[];
  /** Optional store-specific notes (e.g. "Produce is near entrance") */
  notes?: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ItemPriority = 'low' | 'normal' | 'high';

export interface ListItem {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  normalized_name: string;
  category: string;
  zone_key: ZoneKey;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
  is_checked: boolean;
  linked_meal_ids: string[];
  brand_preference: string | null;
  substitute_allowed: boolean;
  priority: ItemPriority;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export type RecipeCategory = 'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'snack' | 'other';

export interface Recipe {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  servings: number;
  /** Optional total time in minutes (shown as a pill on cards and detail). */
  total_time_minutes?: number | null;
  recipe_url?: string | null;
  notes?: string | null;
  /** Step-by-step directions; lines become numbered steps in the UI. */
  instructions?: string | null;
  is_favorite?: boolean;
  category?: RecipeCategory | null;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'custom';

export interface Meal {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  recipe_id: string | null;
  start_date: string | null;
  end_date: string | null;
  /** Planning date (single day). Required for planner. */
  meal_date: string;
  /** Slot: breakfast, lunch, dinner, dessert, or custom. */
  meal_slot: MealSlot;
  /** When meal_slot is 'custom', the user-defined slot name (e.g. "Snack"). */
  custom_slot_name: string | null;
  /** Optional recipe URL. */
  recipe_url: string | null;
  /** Optional note. */
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MealIngredient {
  id: string;
  meal_id: string;
  name: string;
  /** Normalized name for list matching. */
  normalized_name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
  brand_preference: string | null;
}
