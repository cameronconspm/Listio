/**
 * Persistent household suggestion index for quick-add autocomplete.
 * Rebuilt from corpus fetch; patched incrementally on add/save.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scoreSuggestionMatch, canonicalGroceryKey } from './commonGroceryCatalog';
import type { SuggestionCorpusRow } from './suggestionCorpusService';

const STORAGE_KEY = '@listio/suggestion_index_v1';
const MAX_ENTRIES = 2000;

export type SuggestionIndexSource = 'recent' | 'list' | 'recipe' | 'meal' | 'cache';

export type SuggestionIndexEntry = {
  normalized_name: string;
  display_name: string;
  source: SuggestionIndexSource;
  last_used_at?: number;
  frequency: number;
};

type StoredShape = {
  version: 1;
  entries: SuggestionIndexEntry[];
};

const memory = new Map<string, SuggestionIndexEntry>();
let hydrated = false;
let hydratingPromise: Promise<void> | null = null;
let rebuildInflight: Promise<void> | null = null;

function titleCaseWords(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function normalizeKey(name: string): string {
  return canonicalGroceryKey(name) || name.trim().toLowerCase();
}

async function persistNow(): Promise<void> {
  try {
    const payload: StoredShape = {
      version: 1,
      entries: Array.from(memory.values()),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export async function hydrateSuggestionIndex(): Promise<void> {
  if (hydrated) return;
  if (hydratingPromise) return hydratingPromise;
  hydratingPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredShape;
        const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
        for (const entry of entries) {
          if (!entry?.normalized_name || !entry.display_name) continue;
          memory.set(entry.normalized_name, entry);
        }
      }
    } catch {
      // ignore
    } finally {
      hydrated = true;
      hydratingPromise = null;
    }
  })();
  return hydratingPromise;
}

export async function clearSuggestionIndex(): Promise<void> {
  memory.clear();
  hydrated = false;
  hydratingPromise = null;
  rebuildInflight = null;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function upsertEntry(row: {
  normalized_name: string;
  display_name: string;
  source: SuggestionIndexSource;
  last_used_at?: number;
  frequency?: number;
}): void {
  const key = row.normalized_name.trim().toLowerCase();
  if (!key) return;
  const display = row.display_name.trim() || titleCaseWords(key);
  const existing = memory.get(key);
  if (existing) {
    memory.delete(key);
    memory.set(key, {
      normalized_name: key,
      display_name: display,
      source: existing.source === 'recent' ? 'recent' : row.source,
      last_used_at: Math.max(existing.last_used_at ?? 0, row.last_used_at ?? 0) || undefined,
      frequency: existing.frequency + (row.frequency ?? 1),
    });
  } else {
    memory.set(key, {
      normalized_name: key,
      display_name: display,
      source: row.source,
      last_used_at: row.last_used_at,
      frequency: row.frequency ?? 1,
    });
  }
}

export function patchSuggestionIndex(
  rows: {
    display_name: string;
    normalized_name?: string;
    source: SuggestionIndexSource;
    last_used_at?: number;
  }[]
): void {
  if (rows.length === 0) return;
  for (const row of rows) {
    const key = normalizeKey(row.normalized_name ?? row.display_name);
    if (!key) continue;
    upsertEntry({
      normalized_name: key,
      display_name: row.display_name,
      source: row.source,
      last_used_at: row.last_used_at ?? Date.now(),
      frequency: 1,
    });
  }
  if (memory.size > MAX_ENTRIES) {
    const sorted = Array.from(memory.values()).sort((a, b) => {
      const aTime = a.last_used_at ?? 0;
      const bTime = b.last_used_at ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.frequency - b.frequency;
    });
    const toDrop = sorted.slice(0, memory.size - MAX_ENTRIES);
    for (const entry of toDrop) {
      memory.delete(entry.normalized_name);
    }
  }
  void persistNow();
}

export async function rebuildSuggestionIndex(corpus: SuggestionCorpusRow[]): Promise<void> {
  if (rebuildInflight) return rebuildInflight;
  rebuildInflight = (async () => {
    await hydrateSuggestionIndex();
    const recents = Array.from(memory.values()).filter((e) => e.source === 'recent');
    memory.clear();
    for (const row of corpus) {
      upsertEntry({
        normalized_name: row.normalized_name,
        display_name: row.display_name,
        source: row.source,
        last_used_at: row.last_used_at,
        frequency: row.frequency ?? 1,
      });
    }
    for (const recent of recents) {
      upsertEntry(recent);
    }
    if (memory.size > MAX_ENTRIES) {
      const sorted = Array.from(memory.values()).sort((a, b) => {
        const aTime = a.last_used_at ?? 0;
        const bTime = b.last_used_at ?? 0;
        return bTime - aTime;
      });
      memory.clear();
      for (const entry of sorted.slice(0, MAX_ENTRIES)) {
        memory.set(entry.normalized_name, entry);
      }
    }
    await persistNow();
  })().finally(() => {
    rebuildInflight = null;
  });
  return rebuildInflight;
}

export function searchSuggestionIndex(
  query: string,
  limit = 12
): SuggestionIndexEntry[] {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  const lower = trimmed.toLowerCase();
  const scored: { entry: SuggestionIndexEntry; tier: number }[] = [];
  for (const entry of memory.values()) {
    const tier = scoreSuggestionMatch(entry.display_name.toLowerCase(), entry.normalized_name, lower);
    if (tier === null) continue;
    scored.push({ entry, tier });
  }
  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const aTime = a.entry.last_used_at ?? 0;
    const bTime = b.entry.last_used_at ?? 0;
    if (aTime !== bTime) return bTime - aTime;
    if (a.entry.frequency !== b.entry.frequency) return b.entry.frequency - a.entry.frequency;
    return a.entry.display_name.localeCompare(b.entry.display_name);
  });
  return scored.slice(0, limit).map(({ entry }) => entry);
}

export function getSuggestionIndexEntriesForSearch(limit = 200): SuggestionIndexEntry[] {
  return Array.from(memory.values()).slice(0, limit);
}

/** Test-only reset. */
export function __resetSuggestionIndexForTests(): void {
  memory.clear();
  hydrated = false;
  hydratingPromise = null;
  rebuildInflight = null;
}
