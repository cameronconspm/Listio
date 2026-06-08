/**
 * Post-onboarding free-tier ceilings. Generous on purpose: the free plan must
 * let a real grocery week happen so users reach the habit before any upsell.
 * Exceeding any of these prompts the contextual paywall. The premium wedge is
 * the AI features (Smart add / recipe import) and unlimited scale, not basic use.
 *
 * Kept in this dependency-free module (separate from `freeTierLimits`) so copy
 * modules can read the numbers without pulling in the purchase/entitlement stack.
 */
export const FREE_LIST_ITEMS_LIMIT = 50;
export const FREE_MEALS_LIMIT = 7;
export const FREE_RECIPES_LIMIT = 10;
