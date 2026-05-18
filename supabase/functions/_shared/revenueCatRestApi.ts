import {
  buildEntitlementUpsertFromRevenueCatSubscriber,
  type EntitlementUpsertPayload,
} from './premiumEntitlementCore.ts';

export type RevenueCatSubscriberFetchResult =
  | { ok: true; upsert: EntitlementUpsertPayload }
  | { ok: false; reason: 'not_configured' | 'not_found' | 'http_error' | 'invalid_response' };

/**
 * Fetches subscriber state from RevenueCat REST API (secret key) and maps to our mirror row.
 * Used when the webhook mirror is missing or stale but the client SDK shows an active entitlement.
 */
export async function fetchRevenueCatEntitlementUpsert(
  appUserId: string
): Promise<RevenueCatSubscriberFetchResult> {
  const apiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!apiKey?.trim()) {
    return { ok: false, reason: 'not_configured' };
  }

  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (res.status === 404) {
    return { ok: false, reason: 'not_found' };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('RevenueCat REST error', res.status, text.slice(0, 300));
    return { ok: false, reason: 'http_error' };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'invalid_response' };
  }

  const subscriber =
    body && typeof body === 'object' && 'subscriber' in body
      ? (body as { subscriber?: unknown }).subscriber
      : null;

  if (!subscriber || typeof subscriber !== 'object') {
    return { ok: false, reason: 'invalid_response' };
  }

  return {
    ok: true,
    upsert: buildEntitlementUpsertFromRevenueCatSubscriber(
      appUserId,
      subscriber as Record<string, unknown>
    ),
  };
}
