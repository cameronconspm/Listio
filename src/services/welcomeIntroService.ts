/**
 * Tracks whether the user has seen the pre-auth welcome/intro screen at least once.
 *
 * The intro is a marketing/orientation page that appears before any sign-in flow.
 * It is shown once per install (AsyncStorage is cleared on uninstall) and is
 * independent of the post-auth onboarding flow owned by `onboardingService`.
 *
 * Kept deliberately tiny — this is purely a "first-run or not" boolean; any
 * richer segmentation belongs in user preferences after sign-in.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '../utils/logger';

const STORAGE_KEY = '@listio/welcome_intro_seen_v1';

export async function hasSeenWelcomeIntro(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw === '1';
  } catch (e) {
    if (__DEV__) logger.warn('welcomeIntroService: read failed', e);
    // On read failure, prefer to show the intro (false) rather than silently
    // skipping it — worst case the user sees an extra page once.
    return false;
  }
}

export async function markWelcomeIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
  } catch (e) {
    if (__DEV__) logger.warn('welcomeIntroService: write failed', e);
  }
}

/** Test-only: clears the persisted flag so unit tests can exercise first-launch. */
export async function __resetWelcomeIntroSeenForTests(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
