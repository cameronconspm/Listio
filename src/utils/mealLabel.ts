import type { Meal } from '../types/models';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_LABELS: Record<string, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  dessert: 'dessert',
  custom: 'custom',
};

const MAX_CUSTOM_SLOT_COMPACT = 12;

function truncateCompact(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + '…';
}

/** Display + VoiceOver string for list row meal pill. */
export type LinkedMealRowMeta = {
  /** Short label next to the meal icon (e.g. "Sun · dinner") */
  display: string;
  /** Full phrase for accessibility (e.g. "Sunday dinner") */
  accessibilityLabel: string;
};

/**
 * Format meal for List tab secondary line: "Monday dinner" or "Monday Snack" (custom).
 */
export function formatMealLabel(meal: Meal): string {
  const day = meal.meal_date ? DAY_NAMES[parseMealLocalDayIndex(meal.meal_date)] : '';
  const slot =
    meal.meal_slot === 'custom' && meal.custom_slot_name
      ? meal.custom_slot_name
      : SLOT_LABELS[meal.meal_slot] ?? meal.meal_slot;
  return day && slot ? `${day} ${slot}` : meal.name;
}

function parseMealLocalDayIndex(mealDate: string): number {
  return new Date(`${mealDate}T12:00:00`).getDay();
}

/**
 * Shorter list-row label: abbreviated weekday · slot (or truncated custom slot).
 */
export function formatMealLabelCompact(meal: Meal): string {
  const dayAbbrev =
    meal.meal_date != null && meal.meal_date.length >= 8 ? DAY_ABBREV[parseMealLocalDayIndex(meal.meal_date)] : '';
  let slotPart: string;
  if (meal.meal_slot === 'custom' && meal.custom_slot_name?.trim()) {
    slotPart = truncateCompact(meal.custom_slot_name, MAX_CUSTOM_SLOT_COMPACT);
  } else {
    slotPart = SLOT_LABELS[meal.meal_slot] ?? meal.meal_slot;
  }
  if (dayAbbrev && slotPart) return `${dayAbbrev} · ${slotPart}`;
  const name = meal.name?.trim();
  return name ? truncateCompact(name, 18) : 'Meal';
}

export function linkedMealRowMeta(meal: Meal): LinkedMealRowMeta {
  return {
    display: formatMealLabelCompact(meal),
    accessibilityLabel: formatMealLabel(meal),
  };
}

/**
 * Build list-row meal chip text when an item may be linked to multiple planned meals.
 */
export function linkedMealRowMetaFromIds(
  item: { linked_meal_ids?: string[] },
  map: Map<string, LinkedMealRowMeta>
): { display: string; accessibilityLabel: string } | null {
  const ids = item.linked_meal_ids ?? [];
  if (ids.length === 0) return null;
  const metas = ids.map((id) => map.get(id)).filter(Boolean) as LinkedMealRowMeta[];
  if (metas.length === 0) return null;
  if (metas.length === 1) {
    return { display: metas[0].display, accessibilityLabel: metas[0].accessibilityLabel };
  }
  const first = metas[0];
  const rest = metas.length - 1;
  return {
    display: `${first.display} +${rest}`,
    accessibilityLabel: metas.map((m) => m.accessibilityLabel).join('; '),
  };
}
