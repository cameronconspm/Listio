import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';

const MAX_PUSHES_PER_HOUR_PER_HOUSEHOLD = 10;

const WebhookBodySchema = z
  .object({
    type: z.enum(['INSERT', 'UPDATE', 'DELETE']),
    table: z.string(),
    schema: z.string().optional(),
    record: z.record(z.unknown()).optional(),
    old_record: z.record(z.unknown()).optional(),
  })
  .passthrough();

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

  const expected = Deno.env.get('HOUSEHOLD_PUSH_WEBHOOK_SECRET');
  const got =
    req.headers.get('x-webhook-secret') ??
    req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ??
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

  const parsed = WebhookBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { type, table, record } = parsed.data;
  if (table !== 'list_items' || type === 'DELETE') {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!record || typeof record !== 'object') {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const householdId = record.household_id as string | undefined;
  const actorId = record.user_id as string | undefined;
  if (!householdId || !actorId) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countErr } = await admin
    .from('household_push_log')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .gte('sent_at', hourAgo);

  if (countErr) {
    return new Response(JSON.stringify({ error: countErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if ((count ?? 0) >= MAX_PUSHES_PER_HOUR_PER_HOUSEHOLD) {
    return new Response(JSON.stringify({ ok: true, skipped: 'rate_limited' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: members, error: memErr } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);

  if (memErr || !members?.length) {
    return new Response(JSON.stringify({ error: memErr?.message ?? 'members' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const recipients = members.map((m) => m.user_id as string).filter((id) => id !== actorId);
  if (recipients.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const itemName = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'List';
  const title = 'Household list';
  const bodyText =
    type === 'INSERT' ? `${itemName} was added` : `${itemName} was updated`;

  const messages: ExpoPushMessage[] = [];

  for (const uid of recipients) {
    const { data: prefRow } = await admin
      .from('user_preferences')
      .select('payload')
      .eq('user_id', uid)
      .maybeSingle();

    const payload = (prefRow?.payload ?? {}) as {
      notifications?: { householdActivity?: boolean; sharedUpdates?: boolean };
    };
    const n = payload.notifications;
    if (!n?.householdActivity && !n?.sharedUpdates) continue;

    const { data: tokRow } = await admin
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', uid)
      .maybeSingle();

    const token = tokRow?.expo_push_token as string | undefined;
    if (!token) continue;

    messages.push({
      to: token,
      title,
      body: bodyText,
      data: { navigateTo: 'list' },
      sound: 'default',
      priority: 'high',
    });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_recipients' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const expoBody =
    messages.length === 1 ? messages[0] : { messages };

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(expoBody),
  });

  if (!expoRes.ok) {
    const detail = await expoRes.text();
    return new Response(JSON.stringify({ error: 'expo_push', detail }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await admin.from('household_push_log').insert({
    household_id: householdId,
    kind: type === 'INSERT' ? 'list_item_insert' : 'list_item_update',
  });

  return new Response(JSON.stringify({ ok: true, sent: messages.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
