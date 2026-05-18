import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import {
  isEligibleForNativeReview,
  markNativeReviewPromptShown,
  recordAppReviewPositiveMoment,
  requestNativeStoreReview,
  type AppReviewTrigger,
} from '../services/appReviewService';

const NATIVE_PROMPT_DELAY_MS = 600;

type Ctx = {
  /** After a positive moment, maybe invoke Apple’s native in-app review prompt. */
  maybePromptForReview: (trigger: AppReviewTrigger) => void;
  /** QA / dev: invoke native review (no eligibility gate). */
  previewReviewPrompt: () => void;
};

const AppReviewContext = createContext<Ctx | null>(null);

type Props = {
  children: React.ReactNode;
};

export function AppReviewProvider({ children }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const maybePromptForReview = useCallback(
    (trigger: AppReviewTrigger) => {
      void (async () => {
        const { shouldOfferNativeReview } = await recordAppReviewPositiveMoment(trigger);
        if (!shouldOfferNativeReview) return;
        const stillEligible = await isEligibleForNativeReview();
        if (!stillEligible) return;

        clearTimer();
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          void (async () => {
            await markNativeReviewPromptShown();
            await requestNativeStoreReview();
          })();
        }, NATIVE_PROMPT_DELAY_MS);
      })();
    },
    [clearTimer]
  );

  const previewReviewPrompt = useCallback(() => {
    clearTimer();
    void requestNativeStoreReview();
  }, [clearTimer]);

  const value = useMemo(
    () => ({
      maybePromptForReview,
      previewReviewPrompt,
    }),
    [maybePromptForReview, previewReviewPrompt]
  );

  return <AppReviewContext.Provider value={value}>{children}</AppReviewContext.Provider>;
}

export function useAppReview(): Ctx {
  const ctx = useContext(AppReviewContext);
  if (!ctx) {
    throw new Error('useAppReview must be used within AppReviewProvider');
  }
  return ctx;
}

/** Optional hook for screens outside the provider (no-op). */
export function useAppReviewOptional(): Ctx | null {
  return useContext(AppReviewContext);
}
