import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, getUserId, isSyncEnabled } from '../services/supabaseClient';

type AuthUserIdContextValue = {
  /** Signed-in Supabase user id. `null` = not signed in (or sync disabled). `undefined` = not yet resolved. */
  userId: string | null | undefined;
};

const AuthUserIdContext = createContext<AuthUserIdContextValue>({ userId: undefined });

export function AuthUserIdProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(() =>
    isSyncEnabled() ? undefined : null
  );

  useEffect(() => {
    if (!isSyncEnabled()) {
      setUserId(null);
      return;
    }

    let cancelled = false;

    void getUserId().then((id) => {
      if (!cancelled) setUserId(id ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthUserIdContextValue>(() => ({ userId }), [userId]);

  return <AuthUserIdContext.Provider value={value}>{children}</AuthUserIdContext.Provider>;
}

/** Returns the currently signed-in user id, or `null`/`undefined` while resolving. */
export function useAuthUserId(): string | null | undefined {
  return useContext(AuthUserIdContext).userId;
}
