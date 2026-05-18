/** Must match RevenueCat + `src/constants/subscription.ts`. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

export type EntitlementUpsertPayload = {
  user_id: string;
  entitlement_id: string;
  is_active: boolean;
  product_identifier: string | null;
  store: string | null;
  expires_at: string | null;
  will_renew: boolean | null;
};

const STORE_MAP: Record<string, string> = {
  app_store: 'app_store',
  mac_app_store: 'app_store',
  play_store: 'play_store',
  stripe: 'stripe',
  promotional: 'promotional',
  APP_STORE: 'app_store',
  MAC_APP_STORE: 'app_store',
  PLAY_STORE: 'play_store',
  STRIPE: 'stripe',
  PROMOTIONAL: 'promotional',
};

export function mapRevenueCatStoreValue(store: unknown): string | null {
  if (typeof store !== 'string') return null;
  const key = store.trim();
  return STORE_MAP[key] ?? 'unknown';
}

/** Active when no expiry, main expiry in the future, or grace period still valid. */
export function isPremiumActiveFromExpirationDates(
  expiresDateIso: string | null | undefined,
  gracePeriodExpiresDateIso?: string | null
): boolean {
  const now = Date.now();
  if (gracePeriodExpiresDateIso) {
    const grace = new Date(gracePeriodExpiresDateIso).getTime();
    if (Number.isFinite(grace) && grace > now) return true;
  }
  if (!expiresDateIso) return true;
  const exp = new Date(expiresDateIso).getTime();
  return Number.isFinite(exp) && exp > now;
}

export function parseRevenueCatEntitlementPayload(
  userId: string,
  entitlementId: string,
  ent: Record<string, unknown> | null | undefined,
  subscriptionStore?: string | null
): EntitlementUpsertPayload {
  if (!ent) {
    return {
      user_id: userId,
      entitlement_id: entitlementId,
      is_active: false,
      product_identifier: null,
      store: subscriptionStore ?? null,
      expires_at: null,
      will_renew: null,
    };
  }

  const expiresDate = typeof ent.expires_date === 'string' ? ent.expires_date : null;
  const graceDate =
    typeof ent.grace_period_expires_date === 'string' ? ent.grace_period_expires_date : null;
  const productId = typeof ent.product_identifier === 'string' ? ent.product_identifier : null;

  return {
    user_id: userId,
    entitlement_id: entitlementId,
    is_active: isPremiumActiveFromExpirationDates(expiresDate, graceDate),
    product_identifier: productId,
    store: subscriptionStore ?? null,
    expires_at: expiresDate ? new Date(expiresDate).toISOString() : null,
    will_renew: null,
  };
}

/** Map RevenueCat REST `subscriber` object → DB upsert row. */
export function buildEntitlementUpsertFromRevenueCatSubscriber(
  userId: string,
  subscriber: Record<string, unknown>,
  entitlementId: string = PREMIUM_ENTITLEMENT_ID
): EntitlementUpsertPayload {
  const entitlements = subscriber.entitlements as
    | Record<string, Record<string, unknown>>
    | undefined;
  const ent = entitlements?.[entitlementId];

  let store: string | null = null;
  const productId = typeof ent?.product_identifier === 'string' ? ent.product_identifier : null;
  if (productId) {
    const subs = subscriber.subscriptions as Record<string, Record<string, unknown>> | undefined;
    const sub = subs?.[productId];
    store = mapRevenueCatStoreValue(sub?.store);
  }

  return parseRevenueCatEntitlementPayload(userId, entitlementId, ent, store);
}
