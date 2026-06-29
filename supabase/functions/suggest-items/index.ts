/**
 * suggest-items: autocomplete grocery item names for quick-add.
 * Resolution: bundled catalog → user ai_item_cache → OpenAI (rate-limited).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';
import {
  fetchOpenAiWithTimeout,
  OpenAiUpstreamTimeoutError,
  openAiTimeoutResponse,
} from '../_shared/openaiFetch.ts';
import {
  searchCatalogSuggestions,
  scoreSuggestionMatch,
  canonicalGroceryKey,
} from '../_shared/groceryResolverCore.ts';

const MAX_QUERY = 80;
const MAX_LIMIT = 8;
const MIN_OPENAI_QUERY_LEN = 2;
const OPENAI_TRIGGER_MAX = 3;
const MAX_OPENAI_CALLS_PER_HOUR = 35;
const MAX_OPENAI_CALLS_PER_DAY = 200;

const RequestSchema = z.object({
  query: z.string().min(1).max(MAX_QUERY),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
});

type SuggestRow = { display_name: string; normalized_name: string };

function titleCasePhrase(phrase: string): string {
  return phrase
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function dedupeRows(rows: SuggestRow[], limit: number): SuggestRow[] {
  const out: SuggestRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.normalized_name || canonicalGroceryKey(row.display_name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ display_name: row.display_name, normalized_name: key });
    if (out.length >= limit) break;
  }
  return out;
}

function rankRows(rows: SuggestRow[], query: string): SuggestRow[] {
  const lower = query.toLowerCase();
  return [...rows].sort((a, b) => {
    const aTier = scoreSuggestionMatch(a.display_name.toLowerCase(), a.normalized_name, lower) ?? 99;
    const bTier = scoreSuggestionMatch(b.display_name.toLowerCase(), b.normalized_name, lower) ?? 99;
    if (aTier !== bTier) return aTier - bTier;
    return a.display_name.localeCompare(b.display_name);
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const query = parsed.data.query.trim();
    const limit = parsed.data.limit ?? MAX_LIMIT;
    const lower = query.toLowerCase();

    const combined: SuggestRow[] = [];

    for (const row of searchCatalogSuggestions(query, 24)) {
      combined.push({
        display_name: row.display_name,
        normalized_name: row.normalized_name,
      });
    }

    const { data: cacheRows } = await supabaseUser
      .from('ai_item_cache')
      .select('input_text, normalized_name')
      .ilike('normalized_name', `${lower}%`)
      .order('updated_at', { ascending: false })
      .limit(40);

    if (Array.isArray(cacheRows)) {
      for (const row of cacheRows) {
        const display =
          typeof row.input_text === 'string' && row.input_text.trim()
            ? row.input_text.trim()
            : typeof row.normalized_name === 'string'
              ? titleCasePhrase(row.normalized_name)
              : '';
        if (!display) continue;
        const key =
          typeof row.normalized_name === 'string' && row.normalized_name.trim()
            ? row.normalized_name.trim().toLowerCase()
            : canonicalGroceryKey(display);
        const tier = scoreSuggestionMatch(display.toLowerCase(), key, lower);
        if (tier === null) continue;
        combined.push({ display_name: titleCasePhrase(display), normalized_name: key });
      }
    }

    let ranked = dedupeRows(rankRows(combined, query), limit);
    let source: 'catalog' | 'cache' | 'openai' | 'mixed' = ranked.length > 0 ? 'catalog' : 'catalog';

    if (ranked.length < OPENAI_TRIGGER_MAX && query.length >= MIN_OPENAI_QUERY_LEN) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count: hourCount } = await supabaseAdmin
        .from('categorize_openai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('called_at', hourAgo);

      const { count: dayCount } = await supabaseAdmin
        .from('categorize_openai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('called_at', dayAgo);

      if ((hourCount ?? 0) < MAX_OPENAI_CALLS_PER_HOUR && (dayCount ?? 0) < MAX_OPENAI_CALLS_PER_DAY) {
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        if (openaiKey) {
          const prompt = `Return a JSON object with key "suggestions": an array of up to ${limit} common US grocery item names that start with or closely match the partial input "${query}". Each item: display_name (title case), normalized_name (lowercase). Grocery items only. No explanation.`;

          try {
            const openaiRes = await fetchOpenAiWithTimeout('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0,
                max_tokens: 300,
              }),
            });

            if (openaiRes.ok) {
              const openaiData = await openaiRes.json();
              const content = openaiData.choices?.[0]?.message?.content;
              if (content) {
                const obj = JSON.parse(content);
                const arr = Array.isArray(obj?.suggestions) ? obj.suggestions : [];
                for (const raw of arr) {
                  if (!raw || typeof raw !== 'object') continue;
                  const o = raw as Record<string, unknown>;
                  const display =
                    typeof o.display_name === 'string'
                      ? o.display_name.trim()
                      : typeof o.name === 'string'
                        ? o.name.trim()
                        : '';
                  if (!display) continue;
                  const norm =
                    typeof o.normalized_name === 'string' && o.normalized_name.trim()
                      ? o.normalized_name.trim().toLowerCase()
                      : canonicalGroceryKey(display);
                  combined.push({ display_name: titleCasePhrase(display), normalized_name: norm });
                }
                ranked = dedupeRows(rankRows(combined, query), limit);
                source = ranked.length > 0 ? 'mixed' : 'openai';
              }

              await supabaseAdmin.from('categorize_openai_usage').insert({ user_id: user.id });
            }
          } catch (e) {
            if (e instanceof OpenAiUpstreamTimeoutError) {
              return openAiTimeoutResponse(corsHeaders);
            }
          }
        }
      }
    }

    if (combined.length > 0 && ranked.length > 0 && source === 'catalog') {
      source = 'mixed';
    }

    return new Response(JSON.stringify({ suggestions: ranked, source }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('suggest-items: unhandled', e);
    return new Response(JSON.stringify({ error: 'Suggestion service unavailable' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
