import { ensurePremiumViaContextualPaywall } from '../context/contextualPaywallRef';
import type { ContextualPaywallReason } from '../context/contextualPaywallReasons';
import {
  fetchPremiumEntitlementActive,
  shouldEnforceIosSubscriptionGate,
} from './purchasesService';
import { ensureServerSubscriptionMirror } from './subscriptionEntitlementSyncService';

/** Post-onboarding free-tier ceilings. Exceeding any of these prompts the
 *  contextual paywall on every subsequent attempt until the user subscribes. */
export const FREE_LIST_ITEMS_LIMIT = 3;
export const FREE_MEALS_LIMIT = 1;
export const FREE_RECIPES_LIMIT = 1;

export type FreeTierKind = 'list' | 'meal' | 'recipe';

const REASON_BY_KIND: Record<FreeTierKind, ContextualPaywallReason> = {
  list: 'list_limit',
  meal: 'meal_limit',
  recipe: 'recipe_limit',
};

const LIMIT_BY_KIND: Record<FreeTierKind, number> = {
  list: FREE_LIST_ITEMS_LIMIT,
  meal: FREE_MEALS_LIMIT,
  recipe: FREE_RECIPES_LIMIT,
};

const KIND_LABEL: Record<FreeTierKind, string> = {
  list: 'items',
  meal: 'meals',
  recipe: 'recipes',
};

export function freeTierLimitFor(kind: FreeTierKind): number {
  return LIMIT_BY_KIND[kind];
}

export type FreeTierUsageSummary = {
  kind: FreeTierKind;
  used: number;
  limit: number;
  remaining: number;
  atLimit: boolean;
  nearLimit: boolean;
};

export function freeTierUsageSummary(kind: FreeTierKind, currentCount: number): FreeTierUsageSummary {
  const limit = LIMIT_BY_KIND[kind];
  const used = Math.min(Math.max(0, currentCount), limit);
  const remaining = Math.max(0, limit - currentCount);
  return {
    kind,
    used,
    limit,
    remaining,
    atLimit: currentCount >= limit,
    nearLimit: remaining === 1,
  };
}

export function freeTierUsageBannerText(summary: FreeTierUsageSummary): string {
  const label = KIND_LABEL[summary.kind];
  if (summary.atLimit) {
    return `At your free limit (${summary.limit} ${label}) · Listio+`;
  }
  if (summary.nearLimit) {
    return `${summary.used} of ${summary.limit} ${label} · 1 left on free plan`;
  }
  return `${summary.used} of ${summary.limit} ${label} · Free plan`;
}

async function resolvePremiumBeforeFreeTierCheck(
  isKnownPremium?: boolean,
  isPremiumLoading?: boolean
): Promise<boolean> {
  if (isKnownPremium === true) return true;
  if (!shouldEnforceIosSubscriptionGate()) return true;
  if (isPremiumLoading === true) {
    const ok = await fetchPremiumEntitlementActive();
    if (ok) {
      await ensureServerSubscriptionMirror();
      return true;
    }
  }
  return false;
}

/**
 * Returns `true` if the caller may proceed with creating `additional` new
 * items of `kind` given a current persisted `currentCount`. Returns `false`
 * only when the user is over the free-tier limit and dismissed the paywall
 * without subscribing.
 *
 * Pass `isKnownPremium: true` (e.g. from `usePremiumEntitlement().isPremium`)
 * to skip the count check and the RevenueCat round-trip inside
 * `ensurePremiumViaContextualPaywall` on the hot path. Pass `isPremiumLoading:
 * true` when App entitlement is still resolving to avoid false limit paywalls.
 */
export async function ensureFreeTierCapacity(
  kind: FreeTierKind,
  currentCount: number,
  additional: number = 1,
  isKnownPremium?: boolean,
  isPremiumLoading?: boolean
): Promise<boolean> {
  if (additional <= 0) return true;

  const premium = await resolvePremiumBeforeFreeTierCheck(isKnownPremium, isPremiumLoading);
  if (premium) return true;

  const limit = LIMIT_BY_KIND[kind];
  if (currentCount + additional <= limit) return true;
  return ensurePremiumViaContextualPaywall(REASON_BY_KIND[kind]);
}
