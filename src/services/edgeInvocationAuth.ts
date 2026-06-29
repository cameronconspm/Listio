/**
 * In-memory access token resolution for Supabase Edge `functions.invoke` calls.
 *
 * Security / lifetime:
 * - Tokens live only in this module's RAM — never written here for persistence
 *   (Supabase Auth still persists the session via AsyncStorage as usual).
 * - Reuse skips redundant `getSession()` reads when JWT is not near expiry.
 * - Cache is cleared on every `onAuthStateChange` event so sign-out, refresh,
 *   and account switches never reuse a stale JWT.
 * - Do not log access tokens.
 *
 * Refresh policy: if `expires_at` is within 120s, `refreshSession()` runs before
 * returning (same threshold as the prior inline logic in `categorizeItems`).
 */
import {
  supabase,
  getSupabaseProjectRef,
  parseJwtProjectRefFromAccessToken,
  signOutLocallyIfCorruptRefreshToken,
} from './supabaseClient';

export type EdgeAuthPurpose =
  | 'categorizeItems'
  | 'parseRecipeFromText'
  | 'parseListItemsFromText'
  | 'syncSubscriptionEntitlement'
  | 'suggestItems'
  | 'householdInvitePush';

const MESSAGES: Record<
  EdgeAuthPurpose,
  {
    corrupt: string;
    loadFailed: string;
    noToken: string;
    projectMismatch: string;
    expired: string;
  }
> = {
  categorizeItems: {
    corrupt: 'Sign in again to sort items into sections.',
    loadFailed: 'Sign in again to sort items into sections.',
    noToken: 'Sign in again to sort items into sections.',
    projectMismatch: 'Sign out and sign in again.',
    expired: 'Sign in again to sort items into sections.',
  },
  parseRecipeFromText: {
    corrupt: 'Sign in again to import recipes.',
    loadFailed: 'Sign in again to import recipes.',
    noToken: 'Sign in again to import recipes.',
    projectMismatch: 'Sign out and sign in again.',
    expired: 'Sign in again to import recipes.',
  },
  parseListItemsFromText: {
    corrupt: 'Sign in again to use Smart add.',
    loadFailed: 'Sign in again to use Smart add.',
    noToken: 'Sign in again to use Smart add.',
    projectMismatch: 'Sign in again to use Smart add.',
    expired: 'Sign in again to use Smart add.',
  },
  syncSubscriptionEntitlement: {
    corrupt: 'Sign in again to refresh your subscription.',
    loadFailed: 'Sign in again to refresh your subscription.',
    noToken: 'Sign in again to refresh your subscription.',
    projectMismatch: 'Sign out and sign in again.',
    expired: 'Sign in again to refresh your subscription.',
  },
  suggestItems: {
    corrupt: 'Sign in again to see item suggestions.',
    loadFailed: 'Sign in again to see item suggestions.',
    noToken: 'Sign in again to see item suggestions.',
    projectMismatch: 'Sign out and sign in again.',
    expired: 'Sign in again to see item suggestions.',
  },
  householdInvitePush: {
    corrupt: 'Sign in again to send invite notifications.',
    loadFailed: 'Sign in again to send invite notifications.',
    noToken: 'Sign in again to send invite notifications.',
    projectMismatch: 'Sign out and sign in again.',
    expired: 'Sign in again to send invite notifications.',
  },
};

/** Auth state changed while a session read was in flight — retry once with a fresh cache. */
class EdgeAuthStaleLoadError extends Error {
  constructor() {
    super('edge-auth-stale-load');
    this.name = 'EdgeAuthStaleLoadError';
  }
}

type MemoryCache = {
  accessToken: string;
  expiresAtSec: number | null;
  userId: string;
};

let memory: MemoryCache | null = null;
/** Bumped on invalidation so in-flight loads do not repopulate after sign-out. */
let cacheGeneration = 0;
let inflight: Promise<MemoryCache> | null = null;

export function invalidateEdgeInvocationAuthCache(): void {
  cacheGeneration += 1;
  memory = null;
}

function projectRefMismatch(accessToken: string): boolean {
  const cfgRef = getSupabaseProjectRef();
  const jwtRef = parseJwtProjectRefFromAccessToken(accessToken);
  return Boolean(
    jwtRef &&
      cfgRef !== 'not-configured' &&
      cfgRef !== 'unknown' &&
      cfgRef !== 'custom-host' &&
      cfgRef !== 'local' &&
      jwtRef !== cfgRef
  );
}

async function loadFreshSession(purpose: EdgeAuthPurpose, gen: number): Promise<MemoryCache> {
  const msg = MESSAGES[purpose];
  const {
    data: { session: initialSession },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr) {
    if (await signOutLocallyIfCorruptRefreshToken(sessionErr)) {
      throw new Error(msg.corrupt);
    }
    throw new Error(msg.loadFailed);
  }
  let session = initialSession;
  if (!session?.access_token) {
    throw new Error(msg.noToken);
  }
  if (projectRefMismatch(session.access_token)) {
    throw new Error(msg.projectMismatch);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (session.expires_at != null && session.expires_at - nowSec < 120) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr && (await signOutLocallyIfCorruptRefreshToken(refreshErr))) {
      throw new Error(msg.corrupt);
    }
    if (!refreshErr) {
      session = refreshed.session ?? session;
    }
  }

  if (!session?.access_token) {
    throw new Error(msg.expired);
  }
  if (projectRefMismatch(session.access_token)) {
    throw new Error(msg.projectMismatch);
  }
  const uid = session.user?.id;
  if (!uid) {
    throw new Error(msg.noToken);
  }
  if (gen !== cacheGeneration) {
    throw new EdgeAuthStaleLoadError();
  }
  return {
    accessToken: session.access_token,
    expiresAtSec: session.expires_at ?? null,
    userId: uid,
  };
}

/**
 * Returns a JWT suitable for `Authorization: Bearer …` on `supabase.functions.invoke`.
 * Uses a short-lived in-memory cache and single-flight deduplication for concurrent callers.
 */
export async function getValidAccessTokenForEdgeInvoke(
  purpose: EdgeAuthPurpose,
  attempt = 0
): Promise<{ accessToken: string }> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (memory) {
    const { expiresAtSec, accessToken, userId } = memory;
    if (
      userId &&
      expiresAtSec != null &&
      expiresAtSec - nowSec >= 120 &&
      accessToken &&
      !projectRefMismatch(accessToken)
    ) {
      return { accessToken };
    }
  }

  if (!inflight) {
    const gen = cacheGeneration;
    inflight = loadFreshSession(purpose, gen)
      .then((next) => {
        if (gen !== cacheGeneration) {
          throw new EdgeAuthStaleLoadError();
        }
        memory = next;
        return next;
      })
      .finally(() => {
        inflight = null;
      });
  }

  try {
    const next = await inflight;
    return { accessToken: next.accessToken };
  } catch (e) {
    if (e instanceof EdgeAuthStaleLoadError && attempt < 1) {
      return getValidAccessTokenForEdgeInvoke(purpose, attempt + 1);
    }
    if (e instanceof EdgeAuthStaleLoadError) {
      throw new Error(MESSAGES[purpose].corrupt);
    }
    throw e;
  }
}

let authListenerRegistered = false;

function ensureAuthListener(): void {
  if (authListenerRegistered) return;
  if (typeof supabase.auth?.onAuthStateChange !== 'function') {
    return;
  }
  authListenerRegistered = true;
  supabase.auth.onAuthStateChange(() => {
    invalidateEdgeInvocationAuthCache();
  });
}

ensureAuthListener();
