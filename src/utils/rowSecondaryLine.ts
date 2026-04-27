/**
 * Secondary metadata for list rows: quantity + unit, one detail, optional meal source.
 * UI renders each part as its own pill; meal uses icon + compact label in the list.
 * Priority for detail: brand > note snippet > "no substitutes" when subs disallowed.
 */
import type { ListItem } from '../types/models';

const MAX_DETAIL_LENGTH = 28;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + '…';
}

export type RowSecondarySegment =
  | { kind: 'text'; text: string }
  | { kind: 'meal'; text: string; accessibilityLabel: string };

/** Ordered segments for the row metadata line (quantity, detail, compact meal chip). */
export function getRowSecondarySegments(
  item: ListItem,
  linkedMealLabel?: string,
  linkedMealAccessibilityLabel?: string
): RowSecondarySegment[] {
  const hasQty = item.quantity_value != null && item.quantity_unit;
  const qtyPart = hasQty ? `${item.quantity_value} ${item.quantity_unit}` : null;

  const brand = item.brand_preference?.trim();
  const note = item.notes?.trim();
  const noSubs = !item.substitute_allowed;
  const mealSegment: RowSecondarySegment | null =
    linkedMealLabel && item.linked_meal_ids && item.linked_meal_ids.length > 0
      ? {
          kind: 'meal',
          text: linkedMealLabel,
          accessibilityLabel:
            linkedMealAccessibilityLabel ?? `Planned for ${linkedMealLabel}`,
        }
      : null;

  let detail: string | null = null;
  if (brand) detail = truncate(brand, MAX_DETAIL_LENGTH);
  else if (note) detail = truncate(note, MAX_DETAIL_LENGTH);
  else if (noSubs) detail = 'no substitutes';

  const segments: RowSecondarySegment[] = [];
  if (qtyPart) segments.push({ kind: 'text', text: qtyPart });
  if (detail) segments.push({ kind: 'text', text: detail });
  if (mealSegment) segments.push(mealSegment);
  return segments;
}

export function getRowSecondaryLine(
  item: ListItem,
  linkedMealLabel?: string,
  linkedMealAccessibilityLabel?: string
): string | null {
  const segments = getRowSecondarySegments(item, linkedMealLabel, linkedMealAccessibilityLabel);
  if (!segments.length) return null;
  return segments
    .map((s) => (s.kind === 'meal' ? s.accessibilityLabel : s.text))
    .join(' · ');
}
