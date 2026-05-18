import type { ContextualPaywallReason } from './contextualPaywallReasons';
import { ensureServerSubscriptionMirror } from '../services/subscriptionEntitlementSyncService';
import { shouldEnforceIosSubscriptionGate } from '../services/purchasesService';

type Presenter = (reason: ContextualPaywallReason) => Promise<boolean>;

let presenter: Presenter | null = null;

export function setContextualPaywallPresenter(fn: Presenter | null): void {
  presenter = fn;
}

/**
 * Returns true if the user may proceed (already premium, gate disabled, or subscribed after paywall).
 * Returns false if they stay on the free tier without purchasing.
 */
export async function ensurePremiumViaContextualPaywall(reason: ContextualPaywallReason): Promise<boolean> {
  if (!presenter) {
    const { fetchPremiumEntitlementActive } = await import('../services/purchasesService');
    if (!shouldEnforceIosSubscriptionGate()) return true;
    const ok = await fetchPremiumEntitlementActive();
    if (!ok) return false;
    await ensureServerSubscriptionMirror();
    return true;
  }
  return presenter(reason);
}
