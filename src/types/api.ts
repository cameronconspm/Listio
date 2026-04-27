// API request/response types
import type { RecipeCategory, ZoneKey } from './models';

export interface CategorizeItemsRequest {
  items: string[];
  storeType?: string;
}

export interface CategorizeItemResult {
  input: string;
  normalized_name: string;
  category: string;
  zone_key: string;
  confidence: number;
}

export interface CategorizeItemsResponse {
  results: CategorizeItemResult[];
  cache_hits: number;
  cache_misses: number;
}

export interface ParseRecipeRequest {
  recipeText: string;
}

export interface ParsedRecipeIngredient {
  name: string;
  quantity_value: number | null;
  quantity_unit: string | null;
  notes: string | null;
}

export interface ParsedRecipeDraft {
  name: string | null;
  servings: number | null;
  total_time_minutes: number | null;
  category: RecipeCategory | null;
  instructions: string | null;
  notes: string | null;
  recipe_url: string | null;
  ingredients: ParsedRecipeIngredient[];
}

export interface ParseRecipeResponse {
  recipe: ParsedRecipeDraft;
  cache_hit: boolean;
}

/**
 * Result of AI-parsing a free-text shopping description into a ready-to-insert row.
 * Produced by `aiService.parseListItemsFromText` and displayed in the Smart Add review sheet
 * before the user commits to inserting into their list.
 */
export interface ParsedListItem {
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  zone_key: ZoneKey;
  category: string;
}
