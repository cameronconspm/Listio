import { useEffect, useMemo, useRef, useState } from 'react';
import {
  searchItemNameSuggestions,
  type ItemNameSuggestion,
} from '../services/itemNameSuggestions';
import { getCachedCategoryDisplayNames } from '../services/aiCategoryCache';
import { searchSuggestionIndex } from '../services/suggestionIndexStore';
import { fetchRemoteItemSuggestions } from '../services/suggestItemsService';
import type { RecentItem } from '../services/recentItemsStore';

const REMOTE_DEBOUNCE_MS = 350;
const REMOTE_MIN_QUERY_LEN = 2;
const REMOTE_TRIGGER_MAX_LOCAL = 3;

export type UseItemNameSuggestionsOptions = {
  query: string;
  enabled?: boolean;
  listItemNames?: string[];
  recentItems?: RecentItem[];
  includeTypedFallback?: boolean;
};

export function useItemNameSuggestions({
  query,
  enabled = true,
  listItemNames = [],
  recentItems = [],
  includeTypedFallback = true,
}: UseItemNameSuggestionsOptions): {
  suggestions: ItemNameSuggestion[];
  isRemoteLoading: boolean;
} {
  const [remoteNames, setRemoteNames] = useState<{ display_name: string; normalized_name: string }[]>(
    []
  );
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const abortRef = useRef<{ cancelled: boolean } | null>(null);

  const trimmed = query.trim();

  const indexEntries = useMemo(() => {
    if (!enabled || trimmed.length < 1) return [];
    return searchSuggestionIndex(trimmed, 12).map((entry) => ({
      display_name: entry.display_name,
      normalized_name: entry.normalized_name,
      last_used_at: entry.last_used_at,
      frequency: entry.frequency,
    }));
  }, [enabled, trimmed]);

  const cacheNames = useMemo(() => getCachedCategoryDisplayNames(), []);

  const localOnlySuggestions = useMemo(
    () =>
      enabled
        ? searchItemNameSuggestions(trimmed, {
            recentItems,
            listItemNames,
            cacheNames,
            indexEntries,
            includeTypedFallback: false,
          })
        : [],
    [enabled, trimmed, recentItems, listItemNames, cacheNames, indexEntries]
  );

  const nonTypedCount = localOnlySuggestions.length;

  useEffect(() => {
    if (!enabled) {
      setRemoteNames([]);
      setIsRemoteLoading(false);
      return;
    }
    if (trimmed.length < REMOTE_MIN_QUERY_LEN) {
      setRemoteNames([]);
      setIsRemoteLoading(false);
      return;
    }

    if (abortRef.current) {
      abortRef.current.cancelled = true;
    }
    const token = { cancelled: false };
    abortRef.current = token;

    const timeoutId = setTimeout(() => {
      if (token.cancelled) return;
      if (nonTypedCount >= REMOTE_TRIGGER_MAX_LOCAL) {
        setRemoteNames([]);
        setIsRemoteLoading(false);
        return;
      }
      setIsRemoteLoading(true);
      void (async () => {
        try {
          const rows = await fetchRemoteItemSuggestions(trimmed);
          if (token.cancelled) return;
          setRemoteNames(rows);
        } catch {
          if (!token.cancelled) setRemoteNames([]);
        } finally {
          if (!token.cancelled) setIsRemoteLoading(false);
        }
      })();
    }, REMOTE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
      token.cancelled = true;
    };
  }, [enabled, trimmed, nonTypedCount]);

  const suggestions = useMemo(
    () =>
      enabled
        ? searchItemNameSuggestions(trimmed, {
            recentItems,
            listItemNames,
            cacheNames,
            indexEntries,
            remoteNames,
            includeTypedFallback: includeTypedFallback && trimmed.length > 0,
          })
        : [],
    [
      enabled,
      trimmed,
      recentItems,
      listItemNames,
      cacheNames,
      indexEntries,
      remoteNames,
      includeTypedFallback,
    ]
  );

  return { suggestions, isRemoteLoading };
}
