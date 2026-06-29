import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';

const BodySchema = z.object({
  inviteId: z.string().uuid(),
});

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  priority?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: invite, error: inviteErr } = await admin
    .from('household_invites')
    .select('id, household_id, inviter_id, invitee_email, token, accepted_at, expires_at')
    .eq('id', parsed.data.inviteId)
    .maybeSingle();

  if (inviteErr || !invite) {
    return new Response(JSON.stringify({ error: inviteErr?.message ?? 'Invite not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now()) {
    return new Response(JSON.stringify({ ok: true, skipped: 'inactive_invite' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: ownerMembership } = await admin
    .from('household_members')
    .select('role')
    .eq('household_id', invite.household_id)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (ownerMembership?.role !== 'owner' || invite.inviter_id !== authData.user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const inviteeEmail = String(invite.invitee_email).trim().toLowerCase();

  const { data: inviteeUserId, error: lookupErr } = await admin.rpc('find_user_id_by_email', {
    p_email: inviteeEmail,
  });

  if (lookupErr) {
    return new Response(JSON.stringify({ error: lookupErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!inviteeUserId) {
    return new Response(JSON.stringify({ ok: true, skipped: 'invitee_not_registered' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: prefRow } = await admin
    .from('user_preferences')
    .select('payload')
    .eq('user_id', inviteeUserId)
    .maybeSingle();

  const payload = (prefRow?.payload ?? {}) as {
    notifications?: { householdInvites?: boolean; sharedUpdates?: boolean };
  };
  const n = payload.notifications;
  if (n?.householdInvites === false) {
    return new Response(JSON.stringify({ ok: true, skipped: 'prefs_disabled' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: tokRow } = await admin
    .from('user_push_tokens')
    .select('expo_push_token')
    .eq('user_id', inviteeUserId)
    .maybeSingle();

  const token = tokRow?.expo_push_token as string | undefined;
  if (!token) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_push_token' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const message: ExpoPushMessage = {
    to: token,
    title: 'Grocery list invite',
    body: 'Someone invited you to share a Listio grocery list.',
    data: {
      navigateTo: 'shareList',
      inviteToken: invite.token,
    },
    sound: 'default',
    priority: 'high',
  };

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!expoRes.ok) {
    const detail = await expoRes.text();
    return new Response(JSON.stringify({ error: 'expo_push', detail }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, sent: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
