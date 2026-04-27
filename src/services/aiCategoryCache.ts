/**
 * Local AsyncStorage cache for AI categorization results, keyed by `normalized_name`.
 *
 * Goal: repeat adds (e.g. "milk", "chicken breasts", anything the user has added before)
 * bypass the `categorize-items` edge function entirely, saving a ~300–700ms round trip
 * even when the server cache would also have hit.
 *
 * Design:
 *   - In-memory `Map` is the hot-path store. `getCachedCategorySync` never awaits so
 *     `handleComposerSubmit` can branch synchronously.
 *   - `hydrateCategoryCache()` loads AsyncStorage -> Map once at app bootstrap.
 *   - `putCachedCategories(entries)` updates both Map and AsyncStorage (fire-and-forget
 *     persist; never rejects to the caller so the UI path stays clean).
 *   - Bounded at MAX_ENTRIES with LRU eviction on writes; entries older than TTL_MS
 *     are treated as misses and dropped.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ZoneKey } from '../types/models';
import { logger } from '../utils/logger';
import { normalize } from '../utils/normalize';

const STORAGE_KEY = '@listio/ai_category_cache_v1';
const MAX_ENTRIES = 500;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CachedCategoryEntry = {
  normalized_name: string;
  zone_key: ZoneKey;
  category: string;
  cached_at: number;
};

type StoredShape = {
  version: 1;
  entries: CachedCategoryEntry[];
};

const memory = new Map<string, CachedCategoryEntry>();
let hydrated = false;
let hydratingPromise: Promise<void> | null = null;
let pendingPersist: ReturnType<typeof setTimeout> | null = null;

function isFresh(entry: CachedCategoryEntry, now: number): boolean {
  return now - entry.cached_at < TTL_MS;
}

function schedulePersist(): void {
  if (pendingPersist != null) return;
  pendingPersist = setTimeout(() => {
    pendingPersist = null;
    void persistNow();
  }, 250);
}

async function persistNow(): Promise<void> {
  try {
    const payload: StoredShape = {
      version: 1,
      entries: Array.from(memory.values()),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    if (__DEV__) logger.warn('aiCategoryCache: persist failed', e);
  }
}

/**
 * Load persisted cache into memory. Safe to call multiple times (returns the in-flight
 * promise if hydration is already running). Non-blocking for the UI: lookups that happen
 * before hydration completes simply miss (and will be populated after the first AI call).
 */
export async function hydrateCategoryCache(): Promise<void> {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredShape | CachedCategoryEntry[];
        const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
        const now = Date.now();
        for (const entry of entries) {
          if (
            !entry ||
            typeof entry.normalized_name !== 'string' ||
            typeof entry.zone_key !== 'string' ||
            typeof entry.category !== 'string' ||
            typeof entry.cached_at !== 'number'
          ) {
            continue;
          }
          if (!isFresh(entry, now)) continue;
          memory.set(entry.normalized_name, entry);
        }
      }
    } catch (e) {
      if (__DEV__) logger.warn('aiCategoryCache: hydrate failed', e);
    } finally {
      hydrated = true;
      hydratingPromise = null;
    }
  })();
  return hydratingPromise;
}

/**
 * Synchronous lookup for the single-item submit hot path. Returns `null` on miss,
 * on stale entry, or before hydration completes.
 */
export function getCachedCategorySync(name: string): CachedCategoryEntry | null {
  const key = normalize(name);
  if (!key) return null;
  const entry = memory.get(key);
  if (!entry) return null;
  if (!isFresh(entry, Date.now())) {
    memory.delete(key);
    schedulePersist();
    return null;
  }
  return entry;
}

/**
 * Upsert categorization results. Touches `cached_at` on every write so recently-used
 * entries survive LRU eviction.
 */
export async function putCachedCategories(
  entries: { normalized_name: string; zone_key: ZoneKey; category: string }[]
): Promise<void> {
  if (entries.length === 0) return;
  const now = Date.now();
  for (const entry of entries) {
    const key = entry.normalized_name?.trim().toLowerCase();
    if (!key) continue;
    memory.delete(key);
    memory.set(key, {
      normalized_name: key,
      zone_key: entry.zone_key,
      category: entry.category,
      cached_at: now,
    });
  }
  if (memory.size > MAX_ENTRIES) {
    const overflow = memory.size - MAX_ENTRIES;
    const iter = memory.keys();
    for (let i = 0; i < overflow; i++) {
      const key = iter.next().value;
      if (typeof key === 'string') memory.delete(key);
    }
  }
  schedulePersist();
}

/** Wipe both the in-memory map and the persisted blob. Used on sign-out / delete account. */
export async function clearCategoryCache(): Promise<void> {
  memory.clear();
  if (pendingPersist != null) {
    clearTimeout(pendingPersist);
    pendingPersist = null;
  }
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    if (__DEV__) logger.warn('aiCategoryCache: clear failed', e);
  }
}

/** Test-only: reset hydration state (used by unit tests between cases). */
export function __resetCategoryCacheForTests(): void {
  memory.clear();
  hydrated = false;
  hydratingPromise = null;
  if (pendingPersist != null) {
    clearTimeout(pendingPersist);
    pendingPersist = null;
  }
}
