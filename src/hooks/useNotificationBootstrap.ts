import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { refreshDynamicNotifications } from '../services/notificationRefreshService';
import { registerAndSyncPushToken } from '../services/pushTokenService';
import { logger } from '../utils/logger';

/** Min ms between two refresh runs triggered by AppState transitions. */
const APP_STATE_DEBOUNCE_MS = 60_000;
/** Min ms between two refresh runs triggered by query-cache mutations. */
const MUTATION_DEBOUNCE_MS = 10_000;

/**
 * Refreshes dynamic notification content + Expo push token registration.
 * Called from the main app navigator so it only runs after auth +
 * onboarding + paywall gates have cleared.
 *
 * Refresh triggers:
 * - Initial mount (cold start into the app shell).
 * - AppState becoming `active` (foreground), debounced.
 * - Mutations to list / meals / recipes query caches, debounced.
 */
export function useNotificationBootstrap(): void {
  const queryClient = useQueryClient();
  const lastRunRef = useRef<number>(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let mounted = true;

    const runRefresh = async (): Promise<void> => {
      if (inFlightRef.current) {
        await inFlightRef.current;
        return;
      }
      const job = (async () => {
        try {
          await refreshDynamicNotifications();
          await registerAndSyncPushToken();
        } catch (e) {
          logger.warnRelease('useNotificationBootstrap', e);
        } finally {
          lastRunRef.current = Date.now();
        }
      })();
      inFlightRef.current = job;
      try {
        await job;
      } finally {
        if (inFlightRef.current === job) inFlightRef.current = null;
      }
    };

    const runIfDebounceElapsed = (debounceMs: number): void => {
      if (!mounted) return;
      const since = Date.now() - lastRunRef.current;
      if (since < debounceMs) return;
      void runRefresh();
    };

    void runRefresh();

    const appSub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      runIfDebounceElapsed(APP_STATE_DEBOUNCE_MS);
    });

    /**
     * Fire-and-forget refresh after relevant cache mutations. We watch the
     * top-level keys (`listItems`, `homeList`, `meals`, `recipes`) and let
     * the debounce coalesce bursts (e.g. 12 quick item adds) into one run.
     */
    const cacheUnsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const action = (event as unknown as { action?: { type?: string } }).action;
      if (!action || action.type !== 'success') return;
      const key = event.query.queryKey;
      if (!Array.isArray(key) || key.length < 2) return;
      const second = key[1];
      if (
        second !== 'listItems' &&
        second !== 'homeList' &&
        second !== 'meals' &&
        second !== 'mealsRange' &&
        second !== 'recipes' &&
        second !== 'recipesScreen'
      ) {
        return;
      }
      runIfDebounceElapsed(MUTATION_DEBOUNCE_MS);
    });

    return () => {
      mounted = false;
      appSub.remove();
      cacheUnsub();
    };
  }, [queryClient]);
}
