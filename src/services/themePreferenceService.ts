import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserPreferences, patchUserPreferencesIfSync } from './userPreferencesService';
import { getUserId, isSyncEnabled } from './supabaseClient';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@listio/theme_preference';

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

/** Local cache first, then cloud when signed in — same pattern as shopping mode. */
export async function hydrateThemePreference(): Promise<ThemePreference> {
  let next = await readStoredThemePreference();

  if (!isSyncEnabled()) return next;

  try {
    const uid = await getUserId();
    if (!uid) return next;

    const prefs = await fetchUserPreferences();
    const cloud = prefs.appearance?.selectedTheme;
    if (cloud === 'light' || cloud === 'dark' || cloud === 'system') {
      next = cloud;
      await writeStoredThemePreference(next);
    }
  } catch {
    /* keep local */
  }

  return next;
}

export async function persistThemePreference(pref: ThemePreference): Promise<void> {
  await writeStoredThemePreference(pref);
  await patchUserPreferencesIfSync({ appearance: { selectedTheme: pref } });
}
