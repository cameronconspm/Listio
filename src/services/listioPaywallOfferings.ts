import Purchases, { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import type { ListioPaywallPlan, ListioPaywallPlanId } from '../components/paywall/listioPaywallContent';
import { listioPaywallTrialDaysForPlan } from '../components/paywall/listioPaywallContent';
import { LISTIO_PREMIUM_PRODUCT_IDS } from '../constants/subscriptionProducts';
import { subscriptionPlatformEnforced } from '../constants/subscription';
import { logger } from '../utils/logger';
import {
  ensurePurchasesConfigured,
  isRevenueCatNativeLayerSkipped,
} from './purchasesService';

export type ListioPaywallOffering = {
  plans: ListioPaywallPlan[];
  packagesByPlanId: Record<ListioPaywallPlanId, PurchasesPackage | undefined>;
};

function resolvePlanIdFromPackage(pkg: PurchasesPackage): ListioPaywallPlanId | null {
  if (
    pkg.packageType === PACKAGE_TYPE.ANNUAL ||
    pkg.product.identifier === LISTIO_PREMIUM_PRODUCT_IDS.annual
  ) {
    return 'annual';
  }
  if (
    pkg.packageType === PACKAGE_TYPE.MONTHLY ||
    pkg.product.identifier === LISTIO_PREMIUM_PRODUCT_IDS.monthly
  ) {
    return 'monthly';
  }
  if (pkg.product.identifier.includes('annual')) return 'annual';
  if (pkg.product.identifier.includes('monthly')) return 'monthly';
  return null;
}

function introTrialDays(pkg: PurchasesPackage): number | undefined {
  const intro = pkg.product.introPrice;
  if (!intro) return undefined;
  const units = intro.periodNumberOfUnits ?? 0;
  if (units <= 0) return undefined;
  switch (intro.periodUnit) {
    case 'DAY':
      return units;
    case 'WEEK':
      return units * 7;
    default:
      return undefined;
  }
}

function priceLabelForPlan(planId: ListioPaywallPlanId, pkg: PurchasesPackage): string {
  const price = pkg.product.priceString;
  return planId === 'annual' ? `${price}/year` : `${price}/month`;
}

function priceDetailForAnnual(pkg: PurchasesPackage): string | undefined {
  const price = pkg.product.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return undefined;
  const monthly = price / 12;
  const currency = pkg.product.currencyCode ?? 'USD';
  try {
    return `About ${new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(monthly)}/mo`;
  } catch {
    return undefined;
  }
}

function planLabel(planId: ListioPaywallPlanId): string {
  return planId === 'annual' ? 'Yearly' : 'Monthly';
}

function buildPlan(planId: ListioPaywallPlanId, pkg: PurchasesPackage): ListioPaywallPlan {
  const trialDays = introTrialDays(pkg) ?? listioPaywallTrialDaysForPlan(planId);
  return {
    id: planId,
    label: planLabel(planId),
    priceLabel: priceLabelForPlan(planId, pkg),
    priceDetail: planId === 'annual' ? priceDetailForAnnual(pkg) : undefined,
    badge: planId === 'annual' ? 'Best value' : undefined,
    trialDays,
  };
}

/** Loads RevenueCat offerings and maps them to Listio paywall plan cards. */
export async function fetchListioPaywallOffering(): Promise<ListioPaywallOffering | null> {
  if (!subscriptionPlatformEnforced() || isRevenueCatNativeLayerSkipped()) {
    return null;
  }
  await ensurePurchasesConfigured();

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) {
      logger.warnRelease('RevenueCat: no current offering for Listio paywall');
      return null;
    }

    const packagesByPlanId: Record<ListioPaywallPlanId, PurchasesPackage | undefined> = {
      annual: undefined,
      monthly: undefined,
    };

    for (const pkg of current.availablePackages) {
      const planId = resolvePlanIdFromPackage(pkg);
      if (!planId) continue;
      packagesByPlanId[planId] = pkg;
    }

    const plans: ListioPaywallPlan[] = [];
    if (packagesByPlanId.annual) {
      plans.push(buildPlan('annual', packagesByPlanId.annual));
    }
    if (packagesByPlanId.monthly) {
      plans.push(buildPlan('monthly', packagesByPlanId.monthly));
    }

    if (plans.length === 0) {
      logger.warnRelease('RevenueCat: current offering has no annual/monthly packages');
      return null;
    }

    return { plans, packagesByPlanId };
  } catch (e) {
    logger.warnRelease('RevenueCat getOfferings failed', e);
    return null;
  }
}

export function getPackageForPlan(
  offering: ListioPaywallOffering,
  planId: ListioPaywallPlanId
): PurchasesPackage | undefined {
  return offering.packagesByPlanId[planId];
}
