import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import {
  REVENUECAT_ENTITLEMENT_ID,
  isIosSubscriptionGateDisabledViaEnv,
  subscriptionPlatformEnforced,
} from '../constants/subscription';
import { logger } from '../utils/logger';
import {
  ensureServerSubscriptionMirror,
  scheduleSubscriptionEntitlementSync,
} from './subscriptionEntitlementSyncService';

type Extra = {
  revenueCatIosApiKey?: string;
};

function readExtra(): Extra | undefined {
  return Constants.expoConfig?.extra as Extra | undefined;
}

/** Public iOS SDK key from Expo extra / env (see app.config.js). */
export function getRevenueCatIosApiKey(): string {
  const fromEnv = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  const fromExtra = readExtra()?.revenueCatIosApiKey;
  return typeof fromExtra === 'string' ? fromExtra : '';
}

/** When true, the app should require an active RevenueCat entitlement on iOS. */
export function isIosSubscriptionConfigured(): boolean {
  return subscriptionPlatformEnforced() && getRevenueCatIosApiKey().length > 0;
}

/** iOS builds that block the main app until RevenueCat reports the premium entitlement (or internal no-IAP env). */
export function shouldEnforceIosSubscriptionGate(): boolean {
  if (!subscriptionPlatformEnforced()) return false;
  if (isIosSubscriptionGateDisabledViaEnv()) return false;
  return true;
}

/**
 * When true, do not call `Purchases.configure` / native paywalls — only for `EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE`
 * internal builds (EAS profile `internal-no-iap`).
 */
export function isRevenueCatNativeLayerSkipped(): boolean {
  return subscriptionPlatformEnforced() && isIosSubscriptionGateDisabledViaEnv();
}

let purchasesConfigured = false;
/** True after we tried `Purchases.configure` once (success or hard failure — avoids repeat throws). */
let purchasesConfigureAttempted = false;

let revenueCatLoggingInstalled = false;
let customerInfoListenerInstalled = false;

const premiumStatusListeners = new Set<(isPremium: boolean) => void>();

/** Live updates when StoreKit / RevenueCat changes entitlements (renewal, cancel, restore). */
export function subscribePremiumStatusChanges(listener: (isPremium: boolean) => void): () => void {
  premiumStatusListeners.add(listener);
  return () => {
    premiumStatusListeners.delete(listener);
  };
}

function notifyPremiumStatusListeners(isPremium: boolean): void {
  for (const listener of premiumStatusListeners) {
    try {
      listener(isPremium);
    } catch (e) {
      logger.warnRelease('premium status listener failed', e);
    }
  }
}

function handleRevenueCatCustomerInfoUpdate(info: CustomerInfo): void {
  const isPremium = customerInfoHasPremium(info);
  notifyPremiumStatusListeners(isPremium);
  scheduleSubscriptionEntitlementSync();
}

export function installRevenueCatCustomerInfoListener(): void {
  if (customerInfoListenerInstalled || !purchasesConfigured) return;
  if (isRevenueCatNativeLayerSkipped()) return;
  customerInfoListenerInstalled = true;
  Purchases.addCustomerInfoUpdateListener(handleRevenueCatCustomerInfoUpdate);
}

/** Default WARN to avoid flooding Metro; set EXPO_PUBLIC_REVENUECAT_VERBOSE_LOGS=1 for DEBUG. */
function resolveRevenueCatLogLevel(): (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL] {
  const v = process.env.EXPO_PUBLIC_REVENUECAT_VERBOSE_LOGS?.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') {
    return LOG_LEVEL.DEBUG;
  }
  return LOG_LEVEL.WARN;
}

/**
 * Install once before configure: filter benign RC backend races that still surface as ERROR logs.
 */
function revenueCatVerboseLogsEnabled(): boolean {
  const v = process.env.EXPO_PUBLIC_REVENUECAT_VERBOSE_LOGS?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function isBenignRevenueCatLog(level: (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL], message: string): boolean {
  if (level !== LOG_LEVEL.ERROR) return false;
  const lower = message.toLowerCase();
  if (lower.includes('purchase was cancelled')) return true;
  if (lower.includes('show manage subscription') && lower.includes('unable to complete request')) {
    return true;
  }
  if (message.includes('$attConsentStatus') && message.includes('newer value exists')) {
    return true;
  }
  return false;
}

function ensureRevenueCatLogHandlerInstalled(): void {
  if (revenueCatLoggingInstalled) return;
  revenueCatLoggingInstalled = true;
  Purchases.setLogHandler((level, message) => {
    if (typeof message === 'string' && isBenignRevenueCatLog(level, message)) {
      return;
    }
    const line = `[RevenueCat] ${message}`;
    const verbose = revenueCatVerboseLogsEnabled();
    if (!__DEV__ && !verbose) {
      if (level === LOG_LEVEL.ERROR) {
        console.error(line);
      }
      return;
    }
    switch (level) {
      case LOG_LEVEL.VERBOSE:
        console.log(line);
        break;
      case LOG_LEVEL.DEBUG:
        console.debug(line);
        break;
      case LOG_LEVEL.INFO:
        console.info(line);
        break;
      case LOG_LEVEL.WARN:
        console.warn(line);
        break;
      case LOG_LEVEL.ERROR:
        console.error(line);
        break;
      default:
        console.log(line);
    }
  });
}

function isPurchasesConfigurationFailure(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const code = (e as { code?: string }).code;
  return code === Purchases.PURCHASES_ERROR_CODE.CONFIGURATION_ERROR;
}

export async function ensurePurchasesConfigured(): Promise<void> {
  if (isRevenueCatNativeLayerSkipped()) {
    return;
  }
  if (purchasesConfigured || purchasesConfigureAttempted) return;
  if (!subscriptionPlatformEnforced()) return;
  const apiKey = getRevenueCatIosApiKey();
  if (!apiKey) {
    logger.warnRelease('RevenueCat: missing EXPO_PUBLIC_REVENUECAT_IOS_API_KEY');
    return;
  }
  purchasesConfigureAttempted = true;
  try {
    ensureRevenueCatLogHandlerInstalled();
    await Purchases.setLogLevel(resolveRevenueCatLogLevel());
    Purchases.configure({
      apiKey,
      diagnosticsEnabled: false,
    });
    purchasesConfigured = true;
    installRevenueCatCustomerInfoListener();
  } catch (e) {
    logger.warnRelease(
      'RevenueCat: Purchases.configure failed — use a dev client with native modules, not Expo Go',
      e
    );
  }
}

/** True when the `premium` entitlement is active (includes intro/free-trial periods if configured in ASC + RevenueCat). */
export function customerInfoHasPremium(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
}

/** Cold-start entitlement check must finish or the app stays on `LoadingGate` forever. */
const PREMIUM_ENTITLEMENT_CHECK_TIMEOUT_MS = 12_000;

async function getCustomerInfoForBootstrap(): Promise<{
  info: CustomerInfo | null;
  configurationFailure: boolean;
}> {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      logger.warnRelease(
        `RevenueCat getCustomerInfo timed out after ${PREMIUM_ENTITLEMENT_CHECK_TIMEOUT_MS}ms`
      );
      resolve({ info: null, configurationFailure: false });
    }, PREMIUM_ENTITLEMENT_CHECK_TIMEOUT_MS);

    void Purchases.getCustomerInfo()
      .then((info) => {
        clearTimeout(t);
        resolve({ info, configurationFailure: false });
      })
      .catch((e) => {
        clearTimeout(t);
        logger.warnRelease('RevenueCat getCustomerInfo failed', e);
        resolve({ info: null, configurationFailure: isPurchasesConfigurationFailure(e) });
      });
  });
}

/** Whether the user may use the main app (Android: no gate; iOS: premium entitlement or internal no-IAP build). */
export async function fetchPremiumEntitlementActive(): Promise<boolean> {
  if (!subscriptionPlatformEnforced()) return true;
  if (isRevenueCatNativeLayerSkipped()) return true;
  if (!getRevenueCatIosApiKey()) return false;
  await ensurePurchasesConfigured();
  if (!purchasesConfigured) {
    logger.warnRelease(
      'RevenueCat: Purchases did not configure — blocking app access until native IAP / API key is fixed.'
    );
    return false;
  }
  const { info, configurationFailure } = await getCustomerInfoForBootstrap();
  if (info === null) {
    if (configurationFailure) {
      logger.warnRelease(
        'RevenueCat: configuration error — blocking app access until dashboard / products / offerings are fixed.'
      );
      return false;
    }
    logger.warnRelease(
      'RevenueCat: no customer info — blocking app access until StoreKit / network responds.'
    );
    return false;
  }
  const isPremium = customerInfoHasPremium(info);
  notifyPremiumStatusListeners(isPremium);
  return isPremium;
}

/**
 * Links the Supabase user to RevenueCat (`logIn`) and sets the reserved `$email` subscriber attribute
 * when an address is known (email/password or identity `email` data, e.g. some Apple flows).
 */
export async function syncPurchasesIdentity(
  appUserId: string | null,
  accountEmail?: string | null
): Promise<void> {
  if (!subscriptionPlatformEnforced()) return;
  if (isRevenueCatNativeLayerSkipped()) return;
  await ensurePurchasesConfigured();
  if (!purchasesConfigured) return;
  try {
    if (!appUserId) {
      if (!(await Purchases.isAnonymous())) {
        await Purchases.logOut();
      }
      await Purchases.setEmail(null);
      notifyPremiumStatusListeners(false);
      return;
    }
    const { customerInfo } = await Purchases.logIn(appUserId);
    const trimmed = typeof accountEmail === 'string' ? accountEmail.trim() : '';
    if (trimmed.length > 0) {
      await Purchases.setEmail(trimmed);
    }
    const isPremium = customerInfoHasPremium(customerInfo);
    notifyPremiumStatusListeners(isPremium);
    if (isPremium) {
      await ensureServerSubscriptionMirror();
    }
  } catch (e) {
    logger.warnRelease('RevenueCat logIn/logOut/setEmail failed', e);
  }
}

function isPurchaseCancelledError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const code = (e as { code?: string }).code;
  return code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

/**
 * Purchases the selected Listio+ package via RevenueCat / StoreKit.
 * Returns true when the premium entitlement is active after purchase.
 */
export async function purchaseListioPlusPackage(pkg: PurchasesPackage): Promise<boolean> {
  if (isRevenueCatNativeLayerSkipped()) return false;
  await ensurePurchasesConfigured();
  if (!purchasesConfigured) {
    throw new Error('Purchases not configured');
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const hasPremium = customerInfoHasPremium(customerInfo);
    notifyPremiumStatusListeners(hasPremium);
    if (hasPremium) {
      await ensureServerSubscriptionMirror();
    }
    return hasPremium;
  } catch (e) {
    if (isPurchaseCancelledError(e)) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  if (isRevenueCatNativeLayerSkipped()) {
    throw new Error('Purchases not configured');
  }
  await ensurePurchasesConfigured();
  if (!purchasesConfigured) {
    throw new Error('Purchases not configured');
  }
  const info = await Purchases.restorePurchases();
  const hasPremium = customerInfoHasPremium(info);
  notifyPremiumStatusListeners(hasPremium);
  if (hasPremium) {
    await ensureServerSubscriptionMirror();
  }
  return info;
}

/** Opens the App Store subscriptions management page in Safari / App Store (fallback). */
export function getManageSubscriptionsUrl(): string {
  return 'https://apps.apple.com/account/subscriptions';
}

/**
 * Presents Apple’s subscription management UI when available (RevenueCat → StoreKit manage sheet on iOS 13+).
 * Falls back to Apple’s public subscriptions URL if the native sheet cannot be shown.
 */
export async function presentAppleSubscriptionManagement(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  await ensurePurchasesConfigured();

  if (purchasesConfigured) {
    try {
      const info = await Purchases.getCustomerInfo();
      if (!customerInfoHasPremium(info)) {
        await Linking.openURL(getManageSubscriptionsUrl());
        return;
      }
      await Purchases.showManageSubscriptions();
      return;
    } catch (e) {
      logger.warnRelease('Purchases.showManageSubscriptions failed, falling back to subscription URL', e);
    }
  }

  const url = getManageSubscriptionsUrl();
  try {
    await Linking.openURL(url);
  } catch (e) {
    logger.warnRelease('Linking.openURL subscription management failed', e);
    throw e instanceof Error ? e : new Error('Cannot open subscription management');
  }
}
