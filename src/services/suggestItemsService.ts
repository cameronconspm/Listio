import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getValidAccessTokenForEdgeInvoke } from './edgeInvocationAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { canonicalGroceryKey } from './commonGroceryCatalog';

const CACHE_KEY = '@listio/suggest_items_cache_v1';
const MAX_CACHE_ENTRIES = 100;

export type RemoteSuggestItem = {
  display_name: string;
  normalized_name: string;
};

type CacheShape = {
  version: 1;
  entries: Record<string, RemoteSuggestItem[]>;
};

let memoryCache: Record<string, RemoteSuggestItem[]> = {};
let cacheHydrated = false;

async function hydrateCache(): Promise<void> {
  if (cacheHydrated) return;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CacheShape;
      if (parsed?.entries && typeof parsed.entries === 'object') {
        memoryCache = parsed.entries;
      }
    }
  } catch {
    memoryCache = {};
  } finally {
    cacheHydrated = true;
  }
}

async function persistCache(): Promise<void> {
  const keys = Object.keys(memoryCache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    const trimmed = keys.slice(keys.length - MAX_CACHE_ENTRIES);
    const next: Record<string, RemoteSuggestItem[]> = {};
    for (const key of trimmed) next[key] = memoryCache[key];
    memoryCache = next;
  }
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ version: 1, entries: memoryCache }));
  } catch {
    // ignore
  }
}

function cacheKey(query: string): string {
  return query.trim().toLowerCase();
}

export async function fetchRemoteItemSuggestions(
  query: string,
  limit = 8
): Promise<RemoteSuggestItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2 || !isSupabaseConfigured()) return [];

  await hydrateCache();
  const key = cacheKey(trimmed);
  const cached = memoryCache[key];
  if (cached) return cached.slice(0, limit);

  const { accessToken } = await getValidAccessTokenForEdgeInvoke('suggestItems');
  const { data, error } = await supabase.functions.invoke<{
    suggestions?: RemoteSuggestItem[];
  }>('suggest-items', {
    body: { query: trimmed, limit },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) return [];

  const rows = Array.isArray(data?.suggestions) ? data!.suggestions! : [];
  const normalized: RemoteSuggestItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const display = typeof row.display_name === 'string' ? row.display_name.trim() : '';
    if (!display) continue;
    const norm = row.normalized_name?.trim() || canonicalGroceryKey(display);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    normalized.push({ display_name: display, normalized_name: norm });
  }

  memoryCache[key] = normalized;
  void persistCache();
  return normalized.slice(0, limit);
}

export async function clearSuggestItemsCache(): Promise<void> {
  memoryCache = {};
  cacheHydrated = false;
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
