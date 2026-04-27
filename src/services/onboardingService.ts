import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserPreferences, patchUserPreferences } from './userPreferencesService';
import { isSyncEnabled } from './supabaseClient';

export const ONBOARDING_VERSION = 1;
const STORAGE_KEY = '@listio/onboarding_v1';

export async function isOnboardingCompleted(): Promise<boolean> {
  if (isSyncEnabled()) {
    try {
      const p = await fetchUserPreferences();
      const v = p.onboarding?.completedVersion;
      return typeof v === 'number' && v >= ONBOARDING_VERSION;
    } catch {
      return false;
    }
  }
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw === String(ONBOARDING_VERSION);
}

export async function markOnboardingCompleted(): Promise<void> {
  const completedAt = new Date().toISOString();
  if (isSyncEnabled()) {
    await patchUserPreferences({
      onboarding: { completedVersion: ONBOARDING_VERSION, completedAt },
    });
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, String(ONBOARDING_VERSION));
  }
}

export async function clearOnboardingCompletion(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  if (isSyncEnabled()) {
    await patchUserPreferences({
      onboarding: { completedVersion: 0 },
    });
  }
}
