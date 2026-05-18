import { ensurePremiumViaContextualPaywall } from '../context/contextualPaywallRef';
import type { ContextualPaywallReason } from '../context/contextualPaywallReasons';

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

export function freeTierLimitFor(kind: FreeTierKind): number {
  return LIMIT_BY_KIND[kind];
}

/**
 * Returns `true` if the caller may proceed with creating `additional` new
 * items of `kind` given a current persisted `currentCount`. Returns `false`
 * only when the user is over the free-tier limit and dismissed the paywall
 * without subscribing.
 *
 * Pass `isKnownPremium: true` (e.g. from `usePremiumEntitlement().isPremium`)
 * to skip the count check and the RevenueCat round-trip inside
 * `ensurePremiumViaContextualPaywall` on the hot path. The async premium
 * fallback inside `ensurePremiumViaContextualPaywall` still runs when the
 * synchronous flag is unknown, so the gate is correct even if the caller
 * cannot reach the entitlement context.
 */
export async function ensureFreeTierCapacity(
  kind: FreeTierKind,
  currentCount: number,
  additional: number = 1,
  isKnownPremium?: boolean,
): Promise<boolean> {
  if (additional <= 0) return true;
  if (isKnownPremium === true) return true;
  const limit = LIMIT_BY_KIND[kind];
  if (currentCount + additional <= limit) return true;
  return ensurePremiumViaContextualPaywall(REASON_BY_KIND[kind]);
}
