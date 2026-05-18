import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@listio/app_review_v1';

/** Set when you have a live App Store app id (numeric). Enables write-review fallback. */
export const APP_STORE_IOS_APP_ID: string | null = '6761579550';

export type AppReviewTrigger = 'shop_run_complete' | 'meaningful_action';

export type AppReviewState = {
  firstOpenAt: string | null;
  sessionCount: number;
  positiveMomentCount: number;
  /** Times we invoked the native review API (our cap; Apple also throttles). */
  nativePromptCount: number;
  lastNativePromptAt: string | null;
};

const DEFAULT_STATE: AppReviewState = {
  firstOpenAt: null,
  sessionCount: 0,
  positiveMomentCount: 0,
  nativePromptCount: 0,
  lastNativePromptAt: null,
};

/** Minimum app opens before we consider requesting a review. */
export const MIN_SESSIONS_FOR_REVIEW_PROMPT = 3;
/** Minimum days since first open (or enough sessions — see eligibility). */
export const MIN_DAYS_SINCE_FIRST_OPEN = 5;
/** Sessions that can substitute for the day threshold. */
export const MIN_SESSIONS_INSTEAD_OF_DAYS = 8;
export const MAX_NATIVE_REVIEW_PROMPTS = 3;
const PROMPT_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

function isForceReviewPromptEnabled(): boolean {
  return process.env.EXPO_PUBLIC_FORCE_APP_REVIEW_PROMPT === '1';
}

function migrateLegacyParsed(parsed: Record<string, unknown>): Partial<AppReviewState> {
  const legacyCount = parsed.customPromptCount;
  const legacyAt = parsed.lastCustomPromptAt;
  const nativeCount = parsed.nativePromptCount;
  const nativeAt = parsed.lastNativePromptAt;
  return {
    nativePromptCount:
      typeof nativeCount === 'number'
        ? nativeCount
        : typeof legacyCount === 'number'
          ? legacyCount
          : undefined,
    lastNativePromptAt:
      typeof nativeAt === 'string'
        ? nativeAt
        : typeof legacyAt === 'string'
          ? legacyAt
          : undefined,
  };
}

async function readState(): Promise<AppReviewState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const migrated = migrateLegacyParsed(parsed);
    return {
      firstOpenAt: typeof parsed.firstOpenAt === 'string' ? parsed.firstOpenAt : null,
      sessionCount: typeof parsed.sessionCount === 'number' ? Math.max(0, parsed.sessionCount) : 0,
      positiveMomentCount:
        typeof parsed.positiveMomentCount === 'number' ? Math.max(0, parsed.positiveMomentCount) : 0,
      nativePromptCount:
        typeof migrated.nativePromptCount === 'number' ? Math.max(0, migrated.nativePromptCount) : 0,
      lastNativePromptAt: typeof migrated.lastNativePromptAt === 'string' ? migrated.lastNativePromptAt : null,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(next: AppReviewState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function daysSince(iso: string, now = Date.now()): number {
  return (now - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
}

function withinMs(iso: string | null, ms: number, now = Date.now()): boolean {
  if (!iso) return false;
  return now - new Date(iso).getTime() < ms;
}

/** Call once per authenticated main-app session (after onboarding). */
export async function recordAppReviewSession(): Promise<AppReviewState> {
  const prev = await readState();
  const nowIso = new Date().toISOString();
  const next: AppReviewState = {
    ...prev,
    firstOpenAt: prev.firstOpenAt ?? nowIso,
    sessionCount: prev.sessionCount + 1,
  };
  await writeState(next);
  return next;
}

/** Positive moment (e.g. completed shop run). Returns whether we may show Apple’s native review UI. */
export async function recordAppReviewPositiveMoment(
  _trigger: AppReviewTrigger
): Promise<{ shouldOfferNativeReview: boolean; state: AppReviewState }> {
  const prev = await readState();
  const next: AppReviewState = {
    ...prev,
    positiveMomentCount: prev.positiveMomentCount + 1,
    firstOpenAt: prev.firstOpenAt ?? new Date().toISOString(),
  };
  await writeState(next);
  const eligible = await isEligibleForNativeReview(next);
  return { shouldOfferNativeReview: eligible, state: next };
}

export async function isEligibleForNativeReview(state?: AppReviewState): Promise<boolean> {
  if (__DEV__ && !isForceReviewPromptEnabled()) return false;

  const st = state ?? (await readState());
  if (st.nativePromptCount >= MAX_NATIVE_REVIEW_PROMPTS) return false;
  if (withinMs(st.lastNativePromptAt, PROMPT_COOLDOWN_MS)) return false;
  if (st.positiveMomentCount < 1) return false;
  if (st.sessionCount < MIN_SESSIONS_FOR_REVIEW_PROMPT) return false;

  if (!st.firstOpenAt) return false;
  const daysOk = daysSince(st.firstOpenAt) >= MIN_DAYS_SINCE_FIRST_OPEN;
  const sessionsOk = st.sessionCount >= MIN_SESSIONS_INSTEAD_OF_DAYS;
  return daysOk || sessionsOk;
}

/** Call immediately before `requestNativeStoreReview` so we do not spam. */
export async function markNativeReviewPromptShown(): Promise<void> {
  const prev = await readState();
  await writeState({
    ...prev,
    nativePromptCount: prev.nativePromptCount + 1,
    lastNativePromptAt: new Date().toISOString(),
  });
}

/** Opens the system star-rating sheet (Apple may still choose not to show it). */
export async function requestNativeStoreReview(): Promise<boolean> {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) return openAppStoreReviewPage();

    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return openAppStoreReviewPage();

    await StoreReview.requestReview();
    return true;
  } catch (e) {
    logger.warnRelease('StoreReview.requestReview failed', e);
    return openAppStoreReviewPage();
  }
}

async function openAppStoreReviewPage(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !APP_STORE_IOS_APP_ID) return false;
  const url = `https://apps.apple.com/app/id${APP_STORE_IOS_APP_ID}?action=write-review`;
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) return false;
    await Linking.openURL(url);
    return true;
  } catch (e) {
    logger.warnRelease('openAppStoreReviewPage failed', e);
    return false;
  }
}

/** For tests / QA settings. */
export async function resetAppReviewState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function getAppReviewState(): Promise<AppReviewState> {
  return readState();
}
