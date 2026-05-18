import { incrementMeaningfulAction, markSoftPaywallPresented } from './engagementPaywallStore';

/**
 * Call after a successful list insert or new recipe save (fire-and-forget).
 *
 * Historically this presented a one-time soft paywall after a few meaningful
 * actions. That soft paywall has been replaced by hard free-tier capacity
 * gates (see `freeTierLimits.ts`), so this function now only updates the
 * tracking state for analytics / debug surfaces and never presents a paywall.
 */
export function notifyMeaningfulListOrRecipeAction(): void {
  void (async () => {
    const { shouldOfferSoftPaywall } = await incrementMeaningfulAction();
    if (shouldOfferSoftPaywall) {
      await markSoftPaywallPresented();
    }
  })();
}
