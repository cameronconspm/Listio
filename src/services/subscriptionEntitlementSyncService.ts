import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase, hasValidSupabaseSession, isSyncEnabled } from './supabaseClient';
import { getValidAccessTokenForEdgeInvoke } from './edgeInvocationAuth';
import { subscriptionPlatformEnforced } from '../constants/subscription';
import { logger } from '../utils/logger';

export type SubscriptionEntitlementSyncResult = {
  /** Row written from RevenueCat REST (or already mirrored). */
  synced: boolean;
  /** Server mirror reports active premium (used for AI gates). */
  isActive: boolean;
};

let inflight: Promise<SubscriptionEntitlementSyncResult | null> | null = null;

/** Max wait before AI / paywall proceed without blocking the user (webhook may catch up later). */
export const SERVER_MIRROR_SYNC_TIMEOUT_MS = 10_000;

/**
 * Pushes the current RevenueCat subscriber state into `user_subscription_entitlements`
 * so AI edge functions recognize Listio+ (webhook is primary; this repairs gaps).
 */
export async function syncSubscriptionEntitlementToServer(): Promise<SubscriptionEntitlementSyncResult | null> {
  if (!isSyncEnabled() || !subscriptionPlatformEnforced()) {
    return null;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      if (!(await hasValidSupabaseSession())) {
        return null;
      }
      const { accessToken } = await getValidAccessTokenForEdgeInvoke('syncSubscriptionEntitlement');
      const res = await supabase.functions.invoke<{
        synced?: boolean;
        is_active?: boolean;
      }>('sync-subscription-entitlement', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.error) {
        if (res.error instanceof FunctionsHttpError) {
          const status = (res.error.context as Response).status;
          if (status === 503) {
            logger.warnRelease('subscription sync: REVENUECAT_SECRET_API_KEY not configured on server');
          }
        }
        logger.warnRelease('subscription entitlement sync failed', res.error);
        return null;
      }

      return {
        synced: res.data?.synced === true,
        isActive: res.data?.is_active === true,
      };
    } catch (e) {
      logger.warnRelease('subscription entitlement sync threw', e);
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Best-effort mirror refresh with a ceiling so paywall / AI never hang indefinitely.
 * Dedupes concurrent callers via `syncSubscriptionEntitlementToServer`.
 */
export async function ensureServerSubscriptionMirror(): Promise<SubscriptionEntitlementSyncResult | null> {
  if (!isSyncEnabled() || !subscriptionPlatformEnforced()) {
    return null;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      syncSubscriptionEntitlementToServer(),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), SERVER_MIRROR_SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/** Fire-and-forget mirror refresh (boot, background RC listener). */
export function scheduleSubscriptionEntitlementSync(): void {
  void syncSubscriptionEntitlementToServer();
}
