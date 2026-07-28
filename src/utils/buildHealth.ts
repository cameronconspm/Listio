import { Platform } from 'react-native';
import { getRevenueCatIosApiKey, shouldEnforceIosSubscriptionGate } from '../services/purchasesService';
import { isIosSubscriptionGateDisabledViaEnv } from '../constants/subscription';
import {
  getSupabaseProjectRef,
  isSupabaseConfigured,
  isSupabaseSyncRequiredButMisconfigured,
} from '../services/supabaseClient';
import { getCategoryCacheStats } from '../services/aiCategoryCache';
import { isSentryConfigured } from '../services/sentryService';

export type BuildHealthSnapshot = {
  supabaseProjectRef: string;
  supabaseConfigured: boolean;
  supabaseMisconfigured: boolean;
  revenueCatIosKeyPresent: boolean;
  iosSubscriptionGateEnforced: boolean;
  iosSubscriptionGateDisabledViaEnv: boolean;
  sentryConfigured: boolean;
  aiCategoryCacheEntries: number;
  aiCategoryCacheEstimatedBytes: number;
  platform: string;
};

export function getBuildHealthSnapshot(): BuildHealthSnapshot {
  const cache = getCategoryCacheStats();
  return {
    supabaseProjectRef: getSupabaseProjectRef(),
    supabaseConfigured: isSupabaseConfigured(),
    supabaseMisconfigured: isSupabaseSyncRequiredButMisconfigured(),
    revenueCatIosKeyPresent: getRevenueCatIosApiKey().length > 0,
    iosSubscriptionGateEnforced: shouldEnforceIosSubscriptionGate(),
    iosSubscriptionGateDisabledViaEnv: isIosSubscriptionGateDisabledViaEnv(),
    sentryConfigured: isSentryConfigured(),
    aiCategoryCacheEntries: cache.entryCount,
    aiCategoryCacheEstimatedBytes: cache.estimatedBytes,
    platform: Platform.OS,
  };
}

export function formatBuildHealthAlert(snapshot: BuildHealthSnapshot): string {
  const lines = [
    `Platform: ${snapshot.platform}`,
    `Supabase project: ${snapshot.supabaseProjectRef}`,
    `Supabase configured: ${snapshot.supabaseConfigured ? 'yes' : 'no'}`,
    `Supabase misconfigured gate: ${snapshot.supabaseMisconfigured ? 'yes' : 'no'}`,
    `RevenueCat iOS API key in build: ${snapshot.revenueCatIosKeyPresent ? 'yes' : 'no'}`,
    `iOS subscription gate enforced: ${snapshot.iosSubscriptionGateEnforced ? 'yes' : 'no'}`,
    `IAP gate disabled via env: ${snapshot.iosSubscriptionGateDisabledViaEnv ? 'yes' : 'no'}`,
    `Paywall ready (iOS + gate + RC key): ${
      snapshot.platform === 'ios' &&
      snapshot.iosSubscriptionGateEnforced &&
      snapshot.revenueCatIosKeyPresent
        ? 'yes'
        : 'no'
    }`,
    `Sentry DSN in build: ${snapshot.sentryConfigured ? 'yes' : 'no'}`,
    `AI category cache: ${snapshot.aiCategoryCacheEntries} entries (~${snapshot.aiCategoryCacheEstimatedBytes} bytes)`,
  ];
  return lines.join('\n');
}
