import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserPreferences, patchUserPreferencesIfSync } from './userPreferencesService';
import {
  bootstrapSupabaseAuthSession,
  getUserId,
  isSyncEnabled,
} from './supabaseClient';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@listio/theme_preference';

let sessionThemePreference: ThemePreference | null = null;
/** `undefined` = not hydrated yet; `null` = signed out. */
let sessionThemeForUserId: string | null | undefined = undefined;

export function peekSessionThemePreference(): ThemePreference | null {
  return sessionThemePreference;
}

/** @internal Test helper — clears in-memory theme session cache. */
export function resetSessionThemePreferenceForTests(): void {
  sessionThemePreference = null;
  sessionThemeForUserId = undefined;
}

export function normalizeThemePreference(raw: unknown): ThemePreference {
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export async function readStoredThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored == null) return 'system';
    return normalizeThemePreference(stored);
  } catch {
    return 'system';
  }
}

export async function writeStoredThemePreference(pref: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* non-blocking */
  }
}

/**
 * Resolves the user's theme preference before first paint.
 * Waits for Supabase auth bootstrap before reading cloud prefs so we don't
 * flash system mode and then apply a signed-in user's saved appearance.
 */
export async function hydrateThemePreference(): Promise<ThemePreference> {
  let uid: string | null = null;

  if (isSyncEnabled()) {
    try {
      const { session } = await bootstrapSupabaseAuthSession();
      uid = session?.user?.id ?? null;
    } catch {
      uid = null;
    }
  }

  if (sessionThemePreference != null && sessionThemeForUserId === uid) {
    return sessionThemePreference;
  }

  let next = await readStoredThemePreference();

  if (isSyncEnabled() && uid) {
    try {
      const prefs = await fetchUserPreferences();
      const cloud = prefs.appearance?.selectedTheme;
      if (cloud === 'light' || cloud === 'dark' || cloud === 'system') {
        next = cloud;
        await writeStoredThemePreference(next);
      }
    } catch {
      /* keep local */
    }
  }

  sessionThemePreference = next;
  sessionThemeForUserId = uid;
  return next;
}

export async function persistThemePreference(pref: ThemePreference): Promise<void> {
  sessionThemePreference = pref;
  await writeStoredThemePreference(pref);
  await patchUserPreferencesIfSync({ appearance: { selectedTheme: pref } });
  if (isSyncEnabled()) {
    sessionThemeForUserId = (await getUserId()) ?? null;
  }
}
