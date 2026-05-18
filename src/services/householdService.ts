import { supabase, isSyncEnabled } from './supabaseClient';
import { fetchUserPreferences } from './userPreferencesService';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';

/** Fixed UUID for local-only mode (AsyncStorage). */
export const LOCAL_HOUSEHOLD_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Resolve household id for a signed-in user (sync mode only).
 */
async function resolveSyncedHouseholdIdForUser(uid: string): Promise<string> {
  const prefs = await fetchUserPreferences();
  const preferred = prefs.currentHouseholdId;
  if (preferred) {
    const { data: mem } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('household_id', preferred)
      .eq('user_id', uid)
      .maybeSingle();
    if (mem?.household_id) return mem.household_id;
  }

  const { data: first } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (first?.household_id) return first.household_id as string;

  const { data: ensured, error: rpcError } = await supabase.rpc('ensure_user_household');
  if (rpcError) throw new Error(mapDbErrorToUserMessage(rpcError, 'Could not load your data.'));
  if (ensured != null && ensured !== '') return String(ensured);

  throw new Error('No data scope for user');
}

let householdIdInflight: Promise<string> | null = null;
let householdIdInflightUid: string | null = null;
let householdIdResolved: { uid: string; value: string } | null = null;
let householdResolutionGeneration = 0;

function beginHouseholdResolution(uid: string): Promise<string> {
  const generation = ++householdResolutionGeneration;
  return resolveSyncedHouseholdIdForUser(uid)
    .then((v) => {
      if (generation === householdResolutionGeneration) {
        householdIdResolved = { uid, value: v };
      }
      return v;
    })
    .finally(() => {
      if (generation === householdResolutionGeneration) {
        householdIdInflight = null;
        householdIdInflightUid = null;
      }
    });
}

/**
 * Kick off household resolution as early as possible (called from AuthContext.applySession).
 * Subsequent `getCurrentHouseholdId()` calls reuse the inflight/resolved promise instead of
 * paying for an extra `supabase.auth.getUser()` round-trip.
 *
 * Pass `null` to invalidate (sign-out).
 */
export function primeHouseholdId(uid: string | null | undefined): void {
  if (!isSyncEnabled()) return;
  if (!uid) {
    householdIdInflight = null;
    householdIdInflightUid = null;
    householdIdResolved = null;
    householdResolutionGeneration += 1;
    return;
  }
  if (householdIdResolved?.uid === uid) return;
  if (householdIdInflight && householdIdInflightUid === uid) return;
  householdIdResolved = null;
  householdIdInflightUid = uid;
  householdIdInflight = beginHouseholdResolution(uid);
}

/**
 * Active household for synced list/meals/recipes/stores (Postgres RLS scope).
 * Uses user_preferences.currentHouseholdId when valid, otherwise the earliest membership.
 */
export async function getCurrentHouseholdId(): Promise<string> {
  if (!isSyncEnabled()) return LOCAL_HOUSEHOLD_ID;

  if (householdIdResolved) return householdIdResolved.value;
  if (householdIdInflight) return householdIdInflight;

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Not signed in');

  if (householdIdResolved && (householdIdResolved as { uid: string }).uid === uid) {
    return (householdIdResolved as { value: string }).value;
  }
  if (householdIdInflight && householdIdInflightUid === uid) {
    return householdIdInflight;
  }
  householdIdInflightUid = uid;
  householdIdInflight = beginHouseholdResolution(uid);
  return householdIdInflight;
}
