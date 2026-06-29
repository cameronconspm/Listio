import type { ContextualPaywallReason } from '../../context/contextualPaywallReasons';

export type ListioPaywallPlanId = 'annual' | 'monthly';

export type ListioPaywallPlan = {
  id: ListioPaywallPlanId;
  /** Short label, e.g. "Yearly". */
  label: string;
  /** Localized price from StoreKit, e.g. "$29.99/year". */
  priceLabel: string;
  /** Optional savings line under the price, e.g. "About $2.50/mo". */
  priceDetail?: string;
  /** Badge on the plan card, e.g. "Best value". */
  badge?: string;
  /** Intro offer length from StoreKit when available. */
  trialDays?: number;
};

export type ListioPaywallFeature = {
  icon: 'home-outline' | 'cart-outline' | 'calendar-outline' | 'people-outline';
  title: string;
  subtitle: string;
};

/** Free trial length per plan (must match App Store Connect introductory offers). */
export const LISTIO_PLUS_TRIAL_DAYS: Record<ListioPaywallPlanId, number> = {
  annual: 14,
  monthly: 7,
};

/** Outcome-focused bullets: the problem solved, not the feature name. */
export const LISTIO_PLUS_FEATURES: ListioPaywallFeature[] = [
  {
    icon: 'home-outline',
    title: 'Plan at home, shop in store',
    subtitle: 'Plan mode builds your week. Shop mode walks the aisles so nothing gets missed.',
  },
  {
    icon: 'calendar-outline',
    title: 'Recipes, meals, and your list stay linked',
    subtitle: 'Save a recipe, plan it for the week, and the ingredients land on your list without copying.',
  },
  {
    icon: 'cart-outline',
    title: 'More than one list, zero extra work',
    subtitle: 'Keep a regular run, a Costco trip, and a party shop without starting from scratch.',
  },
  {
    icon: 'people-outline',
    title: 'Share the plan, not just a screenshot',
    subtitle: 'Send your list, meal plan, or a recipe so someone else can shop or cook with you.',
  },
];

/** Mock StoreKit-style plans for design preview (replace with `Purchases.getOfferings()`). */
export const MOCK_LISTIO_PAYWALL_PLANS: ListioPaywallPlan[] = [
  {
    id: 'annual',
    label: 'Yearly',
    priceLabel: '$29.99/year',
    priceDetail: 'About $2.50/mo',
    badge: 'Best value',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    priceLabel: '$2.99/month',
  },
];

export function listioPaywallTrialDaysForPlan(
  planId: ListioPaywallPlanId,
  plan?: Pick<ListioPaywallPlan, 'trialDays'>
): number {
  const fromPlan = plan?.trialDays;
  if (typeof fromPlan === 'number' && fromPlan > 0) return fromPlan;
  return LISTIO_PLUS_TRIAL_DAYS[planId];
}

export function listioPaywallTrialShortLabel(
  days: number
): string {
  if (days <= 0) return '';
  if (days === 14) return '2 weeks free';
  if (days === 7) return '7 days free';
  if (days === 1) return '1 day free';
  return `${days} days free`;
}

export function listioPaywallTrialIncludesLabel(
  planId: ListioPaywallPlanId,
  plan?: Pick<ListioPaywallPlan, 'trialDays'>
): string {
  const days = listioPaywallTrialDaysForPlan(planId, plan);
  if (days <= 0) return '';
  if (days === 14) return 'Includes 2 weeks free';
  if (days === 7) return 'Includes 7 days free';
  if (days === 1) return 'Includes 1 day free';
  return `Includes ${days} days free`;
}

export function listioPaywallHeadline(reason?: ContextualPaywallReason | null): string {
  if (reason) return listioPaywallHeadlineForReason(reason);
  return 'Less mental load from list to dinner';
}

export function listioPaywallSubheadline(reason?: ContextualPaywallReason | null): string {
  if (reason) return listioPaywallSubheadlineForReason(reason);
  return 'Listio+ connects your list, meal plan, and recipe book in one place. Try it free and see how much smoother your week feels.';
}

function listioPaywallHeadlineForReason(reason: ContextualPaywallReason): string {
  switch (reason) {
    case 'recipe_url':
      return 'Save the recipe and skip retyping every ingredient';
    case 'recipe_paste':
      return 'Turn pasted recipe text into a list you can shop from';
    case 'smart_add':
      return 'Build your list faster, then shop aisle by aisle';
    case 'engagement':
      return 'You are already in a good rhythm. Keep it going';
    case 'milestone_unlock':
      return 'Your list, meals, and recipes work better together';
    case 'list_limit':
      return 'Your list is outgrowing the free plan';
    case 'meal_limit':
      return 'Plan the whole week, not just a few nights';
    case 'recipe_limit':
      return 'Keep every recipe you actually cook';
    default:
      return 'Less mental load from list to dinner';
  }
}

function listioPaywallSubheadlineForReason(reason: ContextualPaywallReason): string {
  switch (reason) {
    case 'recipe_url':
      return 'Import from a link, add ingredients to your list, and shop in plan or shop mode. Start with a free trial.';
    case 'recipe_paste':
      return 'Pull ingredients from pasted text, save the recipe, and shop without starting over. Start with a free trial.';
    case 'smart_add':
      return 'Smart add fills your list in seconds, then shop mode keeps you moving through the store. Start with a free trial.';
    case 'engagement':
      return 'Unlimited lists, full meal planning, recipe imports, and sharing. Try Listio+ free and keep the momentum.';
    case 'milestone_unlock':
      return 'Plan meals, save recipes, and shop from one connected list. Listio+ unlocks the full workflow on your phone.';
    case 'list_limit':
      return 'Go unlimited on items, plan your full week, and keep every recipe. Try Listio+ free when you are ready.';
    case 'meal_limit':
      return 'Plan every night of the week and let your grocery list catch up automatically. Start with a free trial.';
    case 'recipe_limit':
      return 'Save as many recipes as you want and send them straight to your list or meal plan. Start with a free trial.';
    default:
      return 'Listio+ connects your list, meal plan, and recipe book in one place. Try it free and see how much smoother your week feels.';
  }
}

export function listioPaywallTrialCta(
  planId: ListioPaywallPlanId,
  plan?: Pick<ListioPaywallPlan, 'trialDays'>
): string {
  const days = listioPaywallTrialDaysForPlan(planId, plan);
  if (days <= 0) return 'Continue with Listio+';
  if (days === 14) return 'Start 2-week free trial';
  if (days === 7) return 'Start 7-day free trial';
  if (days === 1) return 'Start 1-day free trial';
  return `Start ${days}-day free trial`;
}

export function listioPaywallTrialFootnote(
  plan: ListioPaywallPlan,
  planId: ListioPaywallPlanId
): string {
  const trialDays = listioPaywallTrialDaysForPlan(planId, plan);
  if (trialDays <= 0) {
    return `${plan.priceLabel}. Cancel anytime in Settings.`;
  }
  return `No payment today. Then ${plan.priceLabel}. Cancel anytime.`;
}

export function listioPaywallRenewFinePrint(
  planId: ListioPaywallPlanId,
  plan?: Pick<ListioPaywallPlan, 'trialDays'>
): string {
  const trialDays = listioPaywallTrialDaysForPlan(planId, plan);
  if (trialDays <= 0) {
    return 'Subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage in Settings, then Subscriptions.';
  }
  const trialLabel =
    trialDays === 14
      ? '2-week trial'
      : trialDays === 7
        ? '7-day trial'
        : trialDays === 1
          ? '1-day trial'
          : `${trialDays}-day trial`;
  return `After your ${trialLabel}, your subscription renews automatically at the price above unless cancelled at least 24 hours before the end of the current period. Manage in Settings, then Subscriptions.`;
}
