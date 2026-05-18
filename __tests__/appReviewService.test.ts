import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAppReviewState,
  isEligibleForNativeReview,
  MAX_NATIVE_REVIEW_PROMPTS,
  recordAppReviewPositiveMoment,
  recordAppReviewSession,
  resetAppReviewState,
  MIN_DAYS_SINCE_FIRST_OPEN,
  MIN_SESSIONS_FOR_REVIEW_PROMPT,
  type AppReviewState,
} from '../src/services/appReviewService';

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true),
  hasAction: jest.fn(async () => true),
  requestReview: jest.fn(async () => undefined),
}));

const OLD_DEV = __DEV__;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function eligibleBase(overrides: Partial<AppReviewState> = {}): AppReviewState {
  return {
    firstOpenAt: daysAgo(MIN_DAYS_SINCE_FIRST_OPEN + 1),
    sessionCount: MIN_SESSIONS_FOR_REVIEW_PROMPT,
    positiveMomentCount: 1,
    nativePromptCount: 0,
    lastNativePromptAt: null,
    ...overrides,
  };
}

describe('appReviewService', () => {
  beforeEach(async () => {
    await resetAppReviewState();
  });

  afterAll(() => {
    Object.defineProperty(global, '__DEV__', { value: OLD_DEV, configurable: true });
  });

  it('increments session count', async () => {
    const s1 = await recordAppReviewSession();
    expect(s1.sessionCount).toBe(1);
    expect(s1.firstOpenAt).toBeTruthy();
    const s2 = await recordAppReviewSession();
    expect(s2.sessionCount).toBe(2);
  });

  it('is not eligible before minimum sessions and positive moment', async () => {
    Object.defineProperty(global, '__DEV__', { value: false, configurable: true });
    const st = eligibleBase({ sessionCount: 1, positiveMomentCount: 0 });
    expect(await isEligibleForNativeReview(st)).toBe(false);
  });

  it('is eligible after thresholds in production mode', async () => {
    Object.defineProperty(global, '__DEV__', { value: false, configurable: true });
    expect(await isEligibleForNativeReview(eligibleBase())).toBe(true);
  });

  it('blocks after max native review attempts', async () => {
    Object.defineProperty(global, '__DEV__', { value: false, configurable: true });
    expect(await isEligibleForNativeReview(eligibleBase({ nativePromptCount: MAX_NATIVE_REVIEW_PROMPTS }))).toBe(
      false
    );
  });

  it('offers native review when positive moment recorded and eligible', async () => {
    Object.defineProperty(global, '__DEV__', { value: false, configurable: true });
    for (let i = 0; i < MIN_SESSIONS_FOR_REVIEW_PROMPT; i++) {
      await recordAppReviewSession();
    }
    const st = await getAppReviewState();
    await AsyncStorage.setItem(
      '@listio/app_review_v1',
      JSON.stringify({
        ...st,
        firstOpenAt: daysAgo(MIN_DAYS_SINCE_FIRST_OPEN + 2),
      })
    );
    const { shouldOfferNativeReview } = await recordAppReviewPositiveMoment('shop_run_complete');
    expect(shouldOfferNativeReview).toBe(true);
  });
});
