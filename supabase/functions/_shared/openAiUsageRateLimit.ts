import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

export type OpenAiUsageCallKind =
  | 'categorize_submit'
  | 'categorize_background'
  | 'suggest'
  | 'smart_add';

const DEFAULT_SUBMIT_PER_HOUR = 40;
const DEFAULT_BACKGROUND_PER_HOUR = 8;
const DEFAULT_SUGGEST_PER_HOUR = 8;
const DEFAULT_DAY_TOTAL = 200;

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function hourlyLimitForKind(kind: OpenAiUsageCallKind): number {
  switch (kind) {
    case 'categorize_submit':
    case 'smart_add':
      return parseLimit(Deno.env.get('OPENAI_CATEGORIZE_SUBMIT_PER_HOUR'), DEFAULT_SUBMIT_PER_HOUR);
    case 'categorize_background':
      return parseLimit(Deno.env.get('OPENAI_CATEGORIZE_BACKGROUND_PER_HOUR'), DEFAULT_BACKGROUND_PER_HOUR);
    case 'suggest':
      return parseLimit(Deno.env.get('OPENAI_SUGGEST_PER_HOUR'), DEFAULT_SUGGEST_PER_HOUR);
    default:
      return DEFAULT_SUBMIT_PER_HOUR;
  }
}

function dayTotalLimit(): number {
  return parseLimit(Deno.env.get('OPENAI_CALLS_PER_DAY'), DEFAULT_DAY_TOTAL);
}

export function mapCategorizeCallKind(raw: unknown): OpenAiUsageCallKind {
  if (raw === 'background') return 'categorize_background';
  return 'categorize_submit';
}

function rateLimitedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Too many requests', code: 'rate_limited' }), {
    status: 429,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function countUsage(
  admin: SupabaseClient,
  userId: string,
  sinceIso: string,
  callKind?: OpenAiUsageCallKind
): Promise<{ count: number; error: unknown }> {
  let query = admin
    .from('categorize_openai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('called_at', sinceIso);
  if (callKind) {
    query = query.eq('call_kind', callKind);
  }
  const { count, error } = await query;
  return { count: count ?? 0, error };
}

export async function assertOpenAiUsageAllowed(
  admin: SupabaseClient,
  userId: string,
  kind: OpenAiUsageCallKind
): Promise<Response | null> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const dayRes = await countUsage(admin, userId, dayAgo);
  if (dayRes.error) {
    console.error('openAiUsageRateLimit: daily count failed', dayRes.error);
    return new Response(JSON.stringify({ error: 'Classification service unavailable' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (dayRes.count >= dayTotalLimit()) {
    return rateLimitedResponse();
  }

  if (kind === 'categorize_submit' || kind === 'smart_add') {
    const submitLimit = hourlyLimitForKind('categorize_submit');
    const [submitRes, smartRes] = await Promise.all([
      countUsage(admin, userId, hourAgo, 'categorize_submit'),
      countUsage(admin, userId, hourAgo, 'smart_add'),
    ]);
    if (submitRes.error || smartRes.error) {
      console.error('openAiUsageRateLimit: submit pool count failed', submitRes.error ?? smartRes.error);
      return new Response(JSON.stringify({ error: 'Classification service unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (submitRes.count + smartRes.count >= submitLimit) {
      return rateLimitedResponse();
    }
    return null;
  }

  const kindHourRes = await countUsage(admin, userId, hourAgo, kind);
  if (kindHourRes.error) {
    console.error('openAiUsageRateLimit: kind hourly count failed', kindHourRes.error);
    return new Response(JSON.stringify({ error: 'Classification service unavailable' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (kindHourRes.count >= hourlyLimitForKind(kind)) {
    return rateLimitedResponse();
  }

  return null;
}

export async function logOpenAiUsage(
  admin: SupabaseClient,
  userId: string,
  kind: OpenAiUsageCallKind
): Promise<void> {
  const { error } = await admin.from('categorize_openai_usage').insert({
    user_id: userId,
    call_kind: kind,
  });
  if (error) {
    console.error('openAiUsageRateLimit: failed to log usage', kind, error.message);
  }
}

export type { SupabaseClient };
