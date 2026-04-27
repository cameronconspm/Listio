import { useState, useEffect, useMemo } from 'react';
import { getRecentSuggestions, type RecentItem } from '../services/recentItemsStore';

/**
 * Load recent item suggestions for the add composer.
 * Loads once when visible; filters client-side by text.
 */
export function useRecentSuggestions(
  visible: boolean,
  text: string,
  editingItem: unknown
): RecentItem[] {
  const [allItems, setAllItems] = useState<RecentItem[]>([]);
  const isEditing = Boolean(editingItem);

  useEffect(() => {
    if (!visible || isEditing) {
      setAllItems([]);
      return;
    }
    getRecentSuggestions('').then(setAllItems);
  }, [visible, isEditing]);

  return useMemo(() => {
    const prefix = text.trim().toLowerCase();
    if (!prefix) return allItems;
    return allItems.filter(
      (i) =>
        i.display_name.toLowerCase().includes(prefix) ||
        i.normalized_name.includes(prefix)
    );
  }, [allItems, text]);
}
