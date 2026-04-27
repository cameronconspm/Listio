import { Platform } from 'react-native';

/**
 * RevenueCat entitlement identifier — create an entitlement with this exact id in the
 * RevenueCat dashboard and attach your App Store subscription products to it.
 *
 * App Store Connect (manual): one subscription group with auto-renewables, e.g.
 * `listio_premium_monthly` ($2.99/mo) and `listio_premium_annual` ($30/yr).
 * Mirror those product ids in RevenueCat and attach both to entitlement `premium`.
 *
 * Introductory offers / free trials: when configured on the subscription in App Store Connect and linked in
 * RevenueCat, users in trial typically have this entitlement in `active` — same as a paid period.
 *
 * iOS Simulator: use a StoreKit Configuration file in Xcode (Scheme → Run → Options) so products load locally.
 * See https://errors.rev.cat/testing-in-simulator
 */
export const REVENUECAT_ENTITLEMENT_ID = 'premium';

/** iOS subscription enforcement is enabled for this build path (Android passes gate until Play Billing is added). */
export function subscriptionPlatformEnforced(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Set `EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE=1` at **build time** (EAS profile `internal-no-iap`, or `.env`)
 * to skip the iOS subscription gate and avoid initializing RevenueCat / presenting paywalls. Use only for internal
 * builds or simulator workflows—not for App Store review (reviewers must see IAP). Ship subscription-enforcing
 * builds with this unset.
 */
export function isIosSubscriptionGateDisabledViaEnv(): boolean {
  const v = process.env.EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE;
  if (typeof v !== 'string') return false;
  const t = v.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes';
}

/** US reference pricing for in-app subscription disclosure; App Store shows localized price at purchase. */
export const LISTIO_PLUS_MONTHLY_USD_LABEL = '$2.99/month';
export const LISTIO_PLUS_ANNUAL_USD_LABEL = '$30/year';
