/**
 * Shared zone-key + OpenAI response coercion helpers used by the `categorize-items`
 * and `smart-add` edge functions. Extracted verbatim so both functions stay in sync
 * on zone aliasing and defensive parsing.
 */

/** Aligned with app `MAX_ITEM_NAME` / ai_item_cache.input_text */
export const MAX_ITEM_STRING = 500;

export const ZONE_KEYS = [
  'produce',
  'bakery_deli',
  'meat_seafood',
  'dairy_eggs',
  'frozen',
  'pantry',
  'snacks_drinks',
  'household_cleaning',
  'personal_care',
  'other',
] as const;

export type ZoneKey = (typeof ZONE_KEYS)[number];

/** Lowercase UI labels → zone_key (models often return labels instead of snake_case). */
export const LABEL_TO_ZONE: Record<string, ZoneKey> = {
  produce: 'produce',
  'bakery & deli': 'bakery_deli',
  'meat & seafood': 'meat_seafood',
  'dairy & eggs': 'dairy_eggs',
  frozen: 'frozen',
  pantry: 'pantry',
  'snacks & drinks': 'snacks_drinks',
  'household & cleaning': 'household_cleaning',
  'personal care': 'personal_care',
  other: 'other',
};

/** Model output often uses short names (e.g. "meat") instead of zone_key slugs. */
export const ZONE_ALIASES: Record<string, ZoneKey> = {
  meat: 'meat_seafood',
  seafood: 'meat_seafood',
  poultry: 'meat_seafood',
  chicken: 'meat_seafood',
  beef: 'meat_seafood',
  pork: 'meat_seafood',
  fish: 'meat_seafood',
  deli: 'bakery_deli',
  bakery: 'bakery_deli',
  dairy: 'dairy_eggs',
  milk: 'dairy_eggs',
  cheese: 'dairy_eggs',
  eggs: 'dairy_eggs',
  yogurt: 'dairy_eggs',
  butter: 'dairy_eggs',
  vegetables: 'produce',
  vegetable: 'produce',
  fruit: 'produce',
  fruits: 'produce',
  produce: 'produce',
  frozen: 'frozen',
  frozen_foods: 'frozen',
  pantry: 'pantry',
  snacks: 'snacks_drinks',
  beverages: 'snacks_drinks',
  drinks: 'snacks_drinks',
  cleaning: 'household_cleaning',
  household: 'household_cleaning',
  pharmacy: 'personal_care',
  personal: 'personal_care',
};

export function normalizeItemText(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function coerceZoneKey(raw: unknown): ZoneKey {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return 'other';
  const asSlug = s.replace(/\s+/g, '_').replace(/&/g, 'and');
  if ((ZONE_KEYS as readonly string[]).includes(asSlug)) {
    return asSlug as ZoneKey;
  }
  if (ZONE_ALIASES[asSlug]) return ZONE_ALIASES[asSlug];
  if (ZONE_ALIASES[s]) return ZONE_ALIASES[s];
  const spaced = s.replace(/\s+/g, ' ').trim();
  if (LABEL_TO_ZONE[spaced]) return LABEL_TO_ZONE[spaced];
  if (LABEL_TO_ZONE[s]) return LABEL_TO_ZONE[s];
  return 'other';
}

export function coerceConfidence(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(1, Math.max(0, raw));
  }
  if (typeof raw === 'string') {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  }
  return 0.5;
}

/**
 * OpenAI often returns string confidences or display-style zone names; strict Zod
 * was failing → everything fell through to "other". This defensively coerces each
 * field so a malformed row doesn't poison the whole response.
 */
export function parseOpenAiRow(
  raw: unknown,
  inputText: string
): {
  normalized_name: string;
  category: string;
  zone_key: ZoneKey;
  confidence: number;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      normalized_name: inputText.slice(0, MAX_ITEM_STRING),
      category: 'other',
      zone_key: 'other',
      confidence: 0.5,
    };
  }
  const o = raw as Record<string, unknown>;
  const nn = o.normalized_name;
  const normalized_name =
    typeof nn === 'string' && nn.trim() ? nn.trim().toLowerCase().replace(/\s+/g, ' ') : inputText;
  const cat = o.category;
  const categoryRaw = typeof cat === 'string' && cat.trim() ? cat : 'other';
  const normalized_name_clamped = normalized_name.slice(0, MAX_ITEM_STRING);
  const category = categoryRaw.slice(0, 200);
  return {
    normalized_name: normalized_name_clamped,
    category,
    zone_key: coerceZoneKey(o.zone_key),
    confidence: coerceConfidence(o.confidence),
  };
}
