import type { UserPreferencesPayload } from '../types/preferences';
import { MAX_USER_PREFERENCES_JSON_BYTES } from '../constants/textLimits';
import { mapDbErrorToUserMessage } from '../utils/mapDbError';
import { supabase, getUserId, isSyncEnabled } from './supabaseClient';

/** Allows partial nested keys (e.g. `location`, `notifications`) — mergePayload deep-merges. */
export type UserPreferencesPatch = Partial<
  Omit<UserPreferencesPayload, 'appearance' | 'location' | 'notifications' | 'listUi' | 'householdUi' | 'funnelAnalytics'>
> & {
  appearance?: Partial<NonNullable<UserPreferencesPayload['appearance']>>;
  location?: Partial<NonNullable<UserPreferencesPayload['location']>>;
  notifications?: Partial<NonNullable<UserPreferencesPayload['notifications']>>;
  listUi?: Partial<NonNullable<UserPreferencesPayload['listUi']>>;
  householdUi?: Partial<NonNullable<UserPreferencesPayload['householdUi']>>;
  funnelAnalytics?: Partial<NonNullable<UserPreferencesPayload['funnelAnalytics']>>;
};

export type { UserPreferencesPayload } from '../types/preferences';

function mergePayload(
  prev: UserPreferencesPayload,
  patch: UserPreferencesPatch
): UserPreferencesPayload {
  const next: UserPreferencesPayload = { ...prev };
  if (patch.shoppingMode !== undefined) next.shoppingMode = patch.shoppingMode;
  if (patch.mealScheduleConfig !== undefined) next.mealScheduleConfig = patch.mealScheduleConfig;
  if (patch.appearance !== undefined) {
    next.appearance = { ...prev.appearance, ...patch.appearance };
  }
  if (patch.units !== undefined) {
    next.units = { ...prev.units, ...patch.units };
  }
  if (patch.notifications !== undefined) {
    const p = patch.notifications;
    const prevN = prev.notifications;
    next.notifications = {
      ...(prevN ?? {}),
      ...p,
      quietHours:
        p.quietHours !== undefined
          ? { ...prevN?.quietHours, ...p.quietHours }
          : prevN?.quietHours,
      notificationAnalytics:
        p.notificationAnalytics !== undefined
          ? { ...prevN?.notificationAnalytics, ...p.notificationAnalytics }
          : prevN?.notificationAnalytics,
    } as UserPreferencesPayload['notifications'];
  }
  if (patch.onboarding !== undefined) {
    next.onboarding = { ...prev.onboarding, ...patch.onboarding };
  }
  if (patch.location !== undefined) {
    next.location = { ...prev.location, ...patch.location } as NonNullable<UserPreferencesPayload['location']>;
  }
  if (patch.recipesUi !== undefined) {
    next.recipesUi = { ...prev.recipesUi, ...patch.recipesUi };
  }
  if (patch.listUi !== undefined) {
    next.listUi = { ...prev.listUi, ...patch.listUi };
  }
  if (patch.funnelAnalytics !== undefined) {
    next.funnelAnalytics = { ...prev.funnelAnalytics, ...patch.funnelAnalytics };
  }
  if (patch.householdUi !== undefined) {
    next.householdUi = { ...prev.householdUi, ...patch.householdUi };
  }
  if (patch.mealsUi !== undefined) {
    next.mealsUi = { ...prev.mealsUi, ...patch.mealsUi };
  }
  if (patch.recentItems !== undefined) {
    next.recentItems = patch.recentItems;
  }
  return next;
}

function payloadByteLength(p: UserPreferencesPayload): number {
  try {
    return new TextEncoder().encode(JSON.stringify(p)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Shrinks payload so it fits DB byte limit (drops recent items tail, then minimal prefs). */
export function fitUserPreferencesPayload(next: UserPreferencesPayload): UserPreferencesPayload {
  let p: UserPreferencesPayload = { ...next };
  while (
    payloadByteLength(p) > MAX_USER_PREFERENCES_JSON_BYTES &&
    p.recentItems &&
    p.recentItems.length > 0
  ) {
    p = { ...p, recentItems: p.recentItems.slice(0, -1) };
  }
  if (payloadByteLength(p) <= MAX_USER_PREFERENCES_JSON_BYTES) return p;
  const minimal: UserPreferencesPayload = {};
  if (payloadByteLength(minimal) <= MAX_USER_PREFERENCES_JSON_BYTES) return minimal;
  return {};
}

let fetchUserPreferencesInflight: Promise<UserPreferencesPayload> | null = null;

async function doFetchUserPreferences(): Promise<UserPreferencesPayload> {
  const uid = await getUserId();
  if (!uid) return {};

  const { data, error } = await supabase
    .from('user_preferences')
    .select('payload')
    .eq('user_id', uid)
    .maybeSingle();

  if (error || !data?.payload || typeof data.payload !== 'object') return {};
  return data.payload as UserPreferencesPayload;
}

/**
 * In-flight dedupe so concurrent bootstrap callers (onboarding check
 * + screen-level prefs reads) share a single round-trip. The dedupe only spans the lifetime
 * of the inflight request; once resolved, the next call re-fetches.
 */
export async function fetchUserPreferences(): Promise<UserPreferencesPayload> {
  if (!isSyncEnabled()) return {};
  if (fetchUserPreferencesInflight) return fetchUserPreferencesInflight;
  fetchUserPreferencesInflight = doFetchUserPreferences().finally(() => {
    fetchUserPreferencesInflight = null;
  });
  return fetchUserPreferencesInflight;
}

export async function patchUserPreferences(patch: UserPreferencesPatch): Promise<void> {
  if (!isSyncEnabled()) return;
  const uid = await getUserId();
  if (!uid) return;

  const { data: row } = await supabase
    .from('user_preferences')
    .select('payload')
    .eq('user_id', uid)
    .maybeSingle();

  const prev: UserPreferencesPayload =
    row?.payload && typeof row.payload === 'object' ? (row.payload as UserPreferencesPayload) : {};

  const next = fitUserPreferencesPayload(mergePayload(prev, patch));

  const { error } = await supabase.from('user_preferences').upsert(
    { user_id: uid, payload: next },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(mapDbErrorToUserMessage(error, 'Could not save settings.'));
}

export async function patchUserPreferencesIfSync(patch: UserPreferencesPatch): Promise<void> {
  if (!isSyncEnabled()) return;
  try {
    await patchUserPreferences(patch);
  } catch {
    // Non-blocking for UI toggles
  }
}
