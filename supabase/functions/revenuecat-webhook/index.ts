import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { buildEntitlementUpsertFromWebhookEvent } from '../_shared/premiumEntitlement.ts';

/**
 * RevenueCat → Supabase entitlement mirror for server-side premium checks.
 *
 * Configure in RevenueCat Dashboard → Integrations → Webhooks:
 *   URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
 *   Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
 *
 * Set secret: supabase secrets set REVENUECAT_WEBHOOK_SECRET=...
 */
function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const got =
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ??
    req.headers.get('x-revenuecat-webhook-secret') ??
    '';
  if (!expected || got !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const event =
    body && typeof body === 'object' && 'event' in body
      ? (body as { event?: unknown }).event
      : body;

  if (!event || typeof event !== 'object') {
    return jsonResponse({ error: 'Missing event' }, 400);
  }

  const eventRecord = event as Record<string, unknown>;
  const eventType = typeof eventRecord.type === 'string' ? eventRecord.type : '';

  if (eventType === 'TEST') {
    return jsonResponse({ ok: true, test: true, message: 'Test event acknowledged' }, 200);
  }

  const upsert = buildEntitlementUpsertFromWebhookEvent(eventRecord);

  if (!upsert) {
    const appUserId =
      typeof eventRecord.app_user_id === 'string' ? eventRecord.app_user_id : '';
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: 'non_uuid_or_unhandled_app_user_id',
      app_user_id: appUserId,
    }, 200);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('revenuecat-webhook: missing Supabase env');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .eq('id', upsert.user_id)
    .maybeSingle();

  if (profileErr) {
    console.error('revenuecat-webhook: profile lookup failed', profileErr);
    return jsonResponse({ error: 'Profile lookup failed' }, 500);
  }

  if (!profile?.id) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: 'no_profile',
      user_id: upsert.user_id,
    }, 200);
  }

  const { error } = await admin.from('user_subscription_entitlements').upsert(upsert, {
    onConflict: 'user_id',
  });

  if (error) {
    console.error('revenuecat-webhook: upsert failed', error);
    return jsonResponse({ error: 'Upsert failed', code: error.code, message: error.message }, 500);
  }

  return jsonResponse({
    ok: true,
    user_id: upsert.user_id,
    is_active: upsert.is_active,
  }, 200);
  } catch (e) {
    console.error('revenuecat-webhook: unhandled', e);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
