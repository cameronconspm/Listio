/**
 * Phase 3: Local store for recent items (add history).
 * Used to suggest re-adding common items in the composer.
 * Capped at 20 distinct items, rolling by recency.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSyncEnabled } from './supabaseClient';
import { patchUserPreferences, patchUserPreferencesIfSync } from './userPreferencesService';

const STORAGE_KEY = '@listio/recent_items';
const MAX_ITEMS = 20;
/** Wider pool for merged quick-add search; UI still caps visible rows. */
export const RECENT_SUGGESTION_SEARCH_CAP = 8;
const MAX_CLOUD_RECENT = 15;
const MAX_CLOUD_JSON = 28000;

export type RecentItem = {
  normalized_name: string;
  display_name: string;
  last_used_at: number;
  last_unit?: string;
};

async function loadRecent(): Promise<RecentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveRecent(items: RecentItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
  const capped = items.slice(0, MAX_CLOUD_RECENT);
  try {
    if (JSON.stringify(capped).length > MAX_CLOUD_JSON) return;
  } catch {
    return;
  }
  await patchUserPreferencesIfSync({ recentItems: capped });
}

/**
 * Record an item as recently added.
 * Moves it to the front if it exists; otherwise prepends and trims to MAX_ITEMS.
 */
export async function recordItemAdded(
  normalizedName: string,
  displayName: string,
  unit?: string | null
): Promise<void> {
  const list = await loadRecent();
  const now = Date.now();
  const entry: RecentItem = {
    normalized_name: normalizedName,
    display_name: displayName,
    last_used_at: now,
    last_unit: unit ?? undefined,
  };

  const filtered = list.filter((i) => i.normalized_name !== normalizedName);
  const updated = [entry, ...filtered].slice(0, MAX_ITEMS);
  await saveRecent(updated);
}

/**
 * Get recent items for suggestions, capped at `searchCap` (default RECENT_SUGGESTION_SEARCH_CAP).
 * Optionally filter by prefix (display_name or normalized_name).
 */
export async function getRecentSuggestions(
  prefix?: string,
  searchCap = RECENT_SUGGESTION_SEARCH_CAP
): Promise<RecentItem[]> {
  const list = await loadRecent();
  const capped = list.slice(0, searchCap);

  if (!prefix || !prefix.trim()) return capped;

  const lower = prefix.trim().toLowerCase();
  return capped.filter(
    (i) =>
      i.display_name.toLowerCase().includes(lower) ||
      i.normalized_name.includes(lower)
  );
}

/** Full recent list for synchronous suggestion merge (already in memory after load). */
export async function loadRecentItemsForSuggestions(): Promise<RecentItem[]> {
  return loadRecent();
}

/** Clears on-device recent suggestions and synced `user_preferences.recentItems` when cloud sync is on. */
export async function clearAllRecentItems(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  if (!isSyncEnabled()) return;
  await patchUserPreferences({ recentItems: [] });
}
