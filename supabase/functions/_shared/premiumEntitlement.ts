import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

/** Must match RevenueCat + `src/constants/subscription.ts`. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSupabaseUserId(appUserId: string): boolean {
  return UUID_RE.test(appUserId.trim());
}

/**
 * Server-side premium check using the RevenueCat webhook mirror table.
 * No row or inactive row → not premium (OpenAI paths should not run).
 */
export async function fetchUserPremiumActive(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('user_subscription_entitlements')
    .select('is_active, expires_at, entitlement_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return false;
  if (data.entitlement_id !== PREMIUM_ENTITLEMENT_ID) return false;
  if (!data.is_active) return false;
  if (data.expires_at) {
    return new Date(data.expires_at).getTime() > Date.now();
  }
  return true;
}

export function premiumRequiredResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Listio+ required for this feature',
      code: 'premium_required',
    }),
    {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

type EntitlementUpsert = {
  user_id: string;
  entitlement_id: string;
  is_active: boolean;
  product_identifier: string | null;
  store: string | null;
  expires_at: string | null;
  will_renew: boolean | null;
};

const STORE_MAP: Record<string, string> = {
  APP_STORE: 'app_store',
  MAC_APP_STORE: 'app_store',
  PLAY_STORE: 'play_store',
  STRIPE: 'stripe',
  PROMOTIONAL: 'promotional',
};

export function mapRevenueCatStore(store: unknown): string | null {
  if (typeof store !== 'string') return null;
  return STORE_MAP[store] ?? 'unknown';
}

/** Derive active state from RevenueCat webhook event fields. */
export function derivePremiumActiveFromWebhookEvent(
  eventType: string,
  entitlementIds: string[],
  expirationAtMs: number | null | undefined
): boolean {
  const hasPremium = entitlementIds.includes(PREMIUM_ENTITLEMENT_ID);
  if (!hasPremium) return false;

  const expiresMs =
    typeof expirationAtMs === 'number' && Number.isFinite(expirationAtMs)
      ? expirationAtMs
      : null;
  const notExpired = expiresMs == null || expiresMs > Date.now();

  switch (eventType) {
    case 'EXPIRATION':
      return false;
    case 'CANCELLATION':
    case 'BILLING_ISSUE':
      return notExpired;
    default:
      return notExpired;
  }
}

function parseEntitlementIds(event: {
  entitlement_ids?: unknown;
  entitlement_id?: unknown;
}): string[] {
  if (Array.isArray(event.entitlement_ids)) {
    return event.entitlement_ids.filter((x): x is string => typeof x === 'string');
  }
  if (typeof event.entitlement_id === 'string' && event.entitlement_id.trim()) {
    return [event.entitlement_id.trim()];
  }
  return [];
}

function parseExpirationAtMs(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function buildEntitlementUpsertFromWebhookEvent(event: {
  app_user_id?: unknown;
  type?: unknown;
  entitlement_ids?: unknown;
  entitlement_id?: unknown;
  product_id?: unknown;
  store?: unknown;
  expiration_at_ms?: unknown;
  auto_renew_status?: unknown;
}): EntitlementUpsert | null {
  const appUserId = typeof event.app_user_id === 'string' ? event.app_user_id.trim() : '';
  if (!isSupabaseUserId(appUserId)) return null;

  const eventType = typeof event.type === 'string' ? event.type : '';
  if (eventType === 'TEST') return null;

  const entitlementIds = parseEntitlementIds(event);

  const expirationAtMs = parseExpirationAtMs(event.expiration_at_ms);

  const isActive = derivePremiumActiveFromWebhookEvent(
    eventType,
    entitlementIds,
    expirationAtMs
  );

  const expiresAt =
    expirationAtMs != null ? new Date(expirationAtMs).toISOString() : null;

  const productId = typeof event.product_id === 'string' ? event.product_id : null;
  const store = mapRevenueCatStore(event.store);

  let willRenew: boolean | null = null;
  if (typeof event.auto_renew_status === 'boolean') {
    willRenew = event.auto_renew_status;
  }

  return {
    user_id: appUserId,
    entitlement_id: PREMIUM_ENTITLEMENT_ID,
    is_active: isActive,
    product_identifier: productId,
    store,
    expires_at: expiresAt,
    will_renew: willRenew,
  };
}
