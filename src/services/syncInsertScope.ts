import { supabase, isSyncEnabled, signOutLocallyIfCorruptRefreshToken } from './supabaseClient';
import { LOCAL_SYNC_SCOPE_ID } from '../constants/localSyncScope';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { fetchUserPreferences } from './userPreferencesService';

let scopeInflight: Promise<string> | null = null;
let scopeInflightUid: string | null = null;
let scopeResolved: { uid: string; value: string } | null = null;
let scopeGeneration = 0;

/**
 * Ensures a fresh Supabase session before Postgres writes (RLS uses `auth.uid()`).
 * Refreshes when the access token is near expiry.
 */
export async function requireAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    if (await signOutLocallyIfCorruptRefreshToken(userError)) {
      throw new Error('Not signed in');
    }
    throw new Error('Not signed in');
  }
  if (!user?.id) throw new Error('Not signed in');

  const nowSec = Math.floor(Date.now() / 1000);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.expires_at != null && session.expires_at - nowSec < 120) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError && (await signOutLocallyIfCorruptRefreshToken(refreshError))) {
      throw new Error('Not signed in');
    }
  }

  return user.id;
}

export function invalidateDataScopeCache(uid?: string | null): void {
  scopeGeneration += 1;
  scopeInflight = null;
  scopeInflightUid = null;
  if (!uid) {
    scopeResolved = null;
    return;
  }
  if (scopeResolved?.uid !== uid) {
    scopeResolved = null;
  }
}

/**
 * Pre-warm data scope on sign-in so the first write does not race auth bootstrap.
 */
export function primeDataScope(uid: string | null | undefined): void {
  if (!isSyncEnabled()) return;
  if (!uid) {
    invalidateDataScopeCache(null);
    return;
  }
  if (scopeResolved?.uid === uid) return;
  if (scopeInflight && scopeInflightUid === uid) return;
  void resolveDataScopeId().catch(() => undefined);
}

async function fetchScopeForUser(uid: string, generation: number): Promise<string> {
  await requireAuthenticatedUserId();
  const preferred = await resolvePreferredHouseholdId(uid);
  if (preferred) {
    if (generation === scopeGeneration) {
      scopeResolved = { uid, value: preferred };
    }
    return preferred;
  }
  const { data, error } = await supabase.rpc('ensure_user_household');
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not load your data.'));
  if (data == null || data === '') throw new Error('Could not load your data.');
  const value = String(data);
  if (generation === scopeGeneration) {
    scopeResolved = { uid, value };
  }
  return value;
}

function beginScopeResolution(uid: string): Promise<string> {
  const generation = scopeGeneration;
  return fetchScopeForUser(uid, generation).finally(() => {
    if (generation === scopeGeneration) {
      scopeInflight = null;
      scopeInflightUid = null;
    }
  });
}

async function verifyHouseholdMembership(householdId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.user_id);
}

/** Prefer shared household from preferences when the user is still a member. */
async function resolvePreferredHouseholdId(userId: string): Promise<string | null> {
  const prefs = await fetchUserPreferences();
  const activeId = prefs.householdUi?.activeHouseholdId;
  if (!activeId) return null;
  const ok = await verifyHouseholdMembership(activeId, userId);
  return ok ? activeId : null;
}

/**
 * Resolves the user's data scope id for Postgres inserts. Each user has a
 * private data namespace (provisioned on first write) that scopes all their
 * list items, meals, recipes, and stores. Returns the local scope constant
 * when cloud sync is disabled.
 */
export async function resolveDataScopeId(): Promise<string> {
  if (!isSyncEnabled()) return LOCAL_SYNC_SCOPE_ID;

  const uid = await requireAuthenticatedUserId();
  if (scopeResolved?.uid === uid) return scopeResolved.value;
  if (scopeInflight && scopeInflightUid === uid) return scopeInflight;

  scopeInflightUid = uid;
  scopeInflight = beginScopeResolution(uid);
  return scopeInflight;
}
