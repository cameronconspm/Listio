/**
 * Phase 3: Duplicate detection and merge suggestions for list items.
 * Uses normalized_name for matching against the active list.
 */
import type { ListItem } from '../types/models';
import type { ParsedItem } from './parseItems';
import { normalize } from './normalize';

export type DuplicateMatch = {
  existing: ListItem;
  /** Same unit → can merge quantities */
  sameUnit: boolean;
  /** Merged quantity if same unit (existing + incoming) */
  mergedQuantity: number;
  /** Merged unit (same as existing when sameUnit) */
  mergedUnit: string | null;
};

/**
 * Find an item on the list that matches the given parsed item (by normalized name).
 * Returns the first match; typically there should be at most one per normalized name.
 */
export function findDuplicate(
  activeItems: ListItem[],
  parsed: ParsedItem
): DuplicateMatch | null {
  const normalized = normalize(parsed.name);
  if (!normalized) return null;

  const existing = activeItems.find((i) => i.normalized_name === normalized);
  if (!existing) return null;

  const existingUnit = (existing.quantity_unit ?? 'ea').toString().toLowerCase();
  const incomingUnit = (parsed.unit ?? 'ea').toLowerCase();
  const sameUnit = existingUnit === incomingUnit;

  const existingQty = existing.quantity_value ?? 1;
  const incomingQty = parsed.quantity ?? 1;
  const mergedQuantity = existingQty + incomingQty;

  return {
    existing,
    sameUnit,
    mergedQuantity,
    mergedUnit: sameUnit ? (existing.quantity_unit ?? 'ea') : null,
  };
}

/**
 * Merge metadata: prefer "stronger" values per Phase 3 plan.
 * - priority: max (high > normal > low)
 * - substitute_allowed: false if either false
 * - brand_preference: prefer non-empty
 * - is_recurring: true if either true
 */
export function mergeMetadata(
  existing: ListItem,
  incoming: ParsedItem
): {
  brand_preference: string | null;
  substitute_allowed: boolean;
  priority: 'low' | 'normal' | 'high';
  is_recurring: boolean;
} {
  const priorityOrder = { low: 0, normal: 1, high: 2 };
  const incPriority = incoming.priority ?? 'normal';
  const exPriority = existing.priority ?? 'normal';
  const priority =
    priorityOrder[incPriority] >= priorityOrder[exPriority] ? incPriority : exPriority;

  return {
    brand_preference:
      incoming.brand_preference?.trim() || existing.brand_preference?.trim() || null,
    substitute_allowed: (incoming.substitute_allowed ?? true) && existing.substitute_allowed,
    priority,
    is_recurring: (incoming.is_recurring ?? false) || existing.is_recurring,
  };
}
