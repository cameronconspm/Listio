import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  isSyncEnabled,
  bootstrapSupabaseAuthSession,
} from '../services/supabaseClient';
import { clearPersistedQueryCache } from '../query/reactQueryPersistence';
import { prefetchHomeListBundle } from '../query/homeListBundle';
import { primeDefaultListId } from '../services/shoppingListService';
import { primeDataScope } from '../services/syncInsertScope';
import { flushFunnelAnalyticsQueue } from '../services/funnelAnalyticsService';
import { resolveAuthAccountEmail } from '../constants/officialTestAccount';
import type { User } from '@supabase/supabase-js';

/** Lazily imported on first sign-in; keeps the import path out of the initial JS bundle. */
function maybeImportLocalDataOnSignInLazy(uid: string): Promise<void> {
  return import('../services/localToCloudImportService')
    .then((m) => m.maybeImportLocalDataOnSignIn(uid))
    .catch(() => undefined);
}

export type AuthContextValue = {
  /** Signed-in Supabase user id. `null` = not signed in. `undefined` = not yet resolved. */
  userId: string | null | undefined;
  /** Resolved account email (or null if not available). Useful for RevenueCat identity sync. */
  userEmail: string | null;
  /** `null` while resolving session; mirrors AppShell gate. */
  isAuthenticated: boolean | null;
  isAuthReady: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  userId: undefined,
  userEmail: null,
  isAuthenticated: null,
  isAuthReady: false,
});

const SESSION_HANG_MS = 25_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null | undefined>(() =>
    isSyncEnabled() ? undefined : null
  );
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() =>
    isSyncEnabled() ? null : false
  );

  const applySession = useCallback(
    (session: { user?: User } | null) => {
      const user = session?.user;
      const signedIn = !!user;
      setIsAuthenticated(signedIn);
      setUserId(user?.id ?? null);
      setUserEmail(resolveAuthAccountEmail(user ?? null));
      const uid = user?.id;
      if (uid) {
        primeDataScope(uid);
        primeDefaultListId(uid);
        void flushFunnelAnalyticsQueue();
        prefetchHomeListBundle(uid, queryClient);
        void maybeImportLocalDataOnSignInLazy(uid);
      } else {
        primeDataScope(null);
        primeDefaultListId(null);
      }
    },
    [queryClient]
  );

  useEffect(() => {
    if (!isSyncEnabled()) {
      setUserId(null);
      setIsAuthenticated(false);
      return;
    }

    let subscription: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    const sessionTimeoutId = setTimeout(() => {
      setIsAuthenticated((prev) => (prev === null ? false : prev));
      setUserId((prev) => (prev === undefined ? null : prev));
    }, SESSION_HANG_MS);

    try {
      const sub = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (cancelled) return;
        applySession(nextSession);
        if (event === 'SIGNED_OUT') {
          void clearPersistedQueryCache();
          queryClient.clear();
        }
      });
      subscription = sub.data.subscription;
    } catch {
      setIsAuthenticated(false);
      setUserId(null);
    }

    void (async () => {
      try {
        const { session, clearedCorruptSession } = await bootstrapSupabaseAuthSession();
        if (cancelled) return;

        if (clearedCorruptSession) {
          await clearPersistedQueryCache();
          queryClient.clear();
        }
        applySession(session);
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
          setUserId(null);
        }
      } finally {
        if (!cancelled) clearTimeout(sessionTimeoutId);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(sessionTimeoutId);
      subscription?.unsubscribe();
    };
  }, [applySession, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      userId,
      userEmail,
      isAuthenticated,
      isAuthReady: isAuthenticated !== null,
    }),
    [userId, userEmail, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/** @deprecated Prefer `useAuth().userId` — kept for gradual migration. */
export function useAuthUserId(): string | null | undefined {
  return useContext(AuthContext).userId;
}
