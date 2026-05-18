import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { fetchUserPremiumActive } from '../_shared/premiumEntitlement.ts';
import { fetchRevenueCatEntitlementUpsert } from '../_shared/revenueCatRestApi.ts';

/**
 * Mirrors the signed-in user's RevenueCat entitlement into `user_subscription_entitlements`.
 *
 * Call after `Purchases.logIn`, purchase, or restore so server-side AI gates match the SDK.
 * Webhooks remain the primary path; this is the repair/sync fallback.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error('sync-subscription-entitlement: missing Supabase env');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authUserError,
    } = await supabaseUser.auth.getUser();
    if (authUserError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fetchResult = await fetchRevenueCatEntitlementUpsert(user.id);
    if (!fetchResult.ok) {
      if (fetchResult.reason === 'not_configured') {
        return new Response(
          JSON.stringify({
            error: 'Subscription sync unavailable',
            code: 'sync_not_configured',
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const isPremium = await fetchUserPremiumActive(admin, user.id);
      return new Response(
        JSON.stringify({
          synced: false,
          is_active: isPremium,
          reason: fetchResult.reason,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: upsertErr } = await admin
      .from('user_subscription_entitlements')
      .upsert(fetchResult.upsert, { onConflict: 'user_id' });

    if (upsertErr) {
      console.error('sync-subscription-entitlement: upsert failed', upsertErr);
      return new Response(JSON.stringify({ error: 'Could not save entitlement' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isPremium = await fetchUserPremiumActive(admin, user.id);

    return new Response(
      JSON.stringify({
        synced: true,
        is_active: isPremium,
        mirror_is_active: fetchResult.upsert.is_active,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('sync-subscription-entitlement: unhandled', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
