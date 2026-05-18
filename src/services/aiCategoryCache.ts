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
import {
  resolveCommonGroceryCategory,
  resolveFromCategoryEntries,
  type FastCategoryResult,
} from './commonGroceryCatalog';

const STORAGE_KEY = '@listio/ai_category_cache_v1';
const MAX_ENTRIES = 500;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Warn in release logs when persisted JSON exceeds this size (AsyncStorage pressure). */
const WARN_PERSISTED_BYTES = 400_000;

let lastPersistedSizeWarnAt = 0;

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

function estimatePersistedBytes(): number {
  try {
    return JSON.stringify({ version: 1, entries: Array.from(memory.values()) }).length;
  } catch {
    return 0;
  }
}

function warnIfCachePayloadLarge(context: string, byteSize: number): void {
  if (byteSize < WARN_PERSISTED_BYTES) return;
  const now = Date.now();
  if (now - lastPersistedSizeWarnAt < 60_000) return;
  lastPersistedSizeWarnAt = now;
  logger.warnRelease(
    `aiCategoryCache: large payload (${byteSize} bytes) after ${context}; consider clearCategoryCache if slow`
  );
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
    const serialized = JSON.stringify(payload);
    warnIfCachePayloadLarge('persist', serialized.length);
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
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
        warnIfCachePayloadLarge('hydrate', estimatePersistedBytes());
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

export type FastCategoryEntry = {
  normalized_name: string;
  zone_key: ZoneKey;
  category: string;
  confidence: number;
  source: 'cache_exact' | FastCategoryResult['source'];
};

/**
 * Resolve an item without waiting on the network. Order is intentionally conservative:
 * exact user cache, curated common catalog, then fuzzy/partial matches against fresh user cache.
 */
export function resolveCategoryFast(name: string): FastCategoryEntry | null {
  const exact = getCachedCategorySync(name);
  if (exact && exact.zone_key !== 'other') {
    return {
      normalized_name: exact.normalized_name,
      zone_key: exact.zone_key,
      category: exact.category,
      confidence: 1,
      source: 'cache_exact',
    };
  }

  const common = resolveCommonGroceryCategory(name);
  if (common) {
    return common;
  }

  if (exact) {
    return {
      normalized_name: exact.normalized_name,
      zone_key: exact.zone_key,
      category: exact.category,
      confidence: 1,
      source: 'cache_exact',
    };
  }

  const now = Date.now();
  const freshEntries = Array.from(memory.values()).filter((entry) => isFresh(entry, now));
  const fuzzyCached = resolveFromCategoryEntries(name, freshEntries);
  if (!fuzzyCached) return null;

  return fuzzyCached;
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

/**
 * Warm the local cache from list rows so re-adding an on-list item resolves synchronously.
 * Skips `other` zones and does not downgrade fresher cache entries.
 */
export function seedCategoryCacheFromListItems(
  items: { normalized_name: string; zone_key: ZoneKey; category: string }[]
): void {
  if (items.length === 0) return;
  const now = Date.now();
  for (const item of items) {
    const key = item.normalized_name?.trim().toLowerCase();
    if (!key || item.zone_key === 'other') continue;
    const category = item.category?.trim();
    if (!category) continue;
    const existing = memory.get(key);
    if (existing && isFresh(existing, now) && existing.zone_key !== 'other') continue;
    memory.delete(key);
    memory.set(key, {
      normalized_name: key,
      zone_key: item.zone_key,
      category,
      cached_at: now,
    });
  }
  if (memory.size > MAX_ENTRIES) {
    const overflow = memory.size - MAX_ENTRIES;
    const iter = memory.keys();
    for (let i = 0; i < overflow; i++) {
      const k = iter.next().value;
      if (typeof k === 'string') memory.delete(k);
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

/** QA / build health: in-memory entry count and estimated persisted JSON size. */
export function getCategoryCacheStats(): { entryCount: number; estimatedBytes: number } {
  const estimatedBytes = estimatePersistedBytes();
  return { entryCount: memory.size, estimatedBytes };
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
