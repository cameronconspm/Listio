import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';
import {
  MAX_ITEM_STRING,
  ZONE_KEYS,
  normalizeItemText as normalize,
  parseOpenAiRow,
  type ZoneKey,
} from '../_shared/categorizeHelpers.ts';
import {
  resolveCommonGroceryCategory,
  resolveFromCategoryEntries,
} from '../_shared/commonGroceryCatalog.ts';
import { tokensForFuzzyCacheLookup } from '../_shared/groceryResolverCore.ts';
import { fetchUserPremiumActive } from '../_shared/premiumEntitlement.ts';
import {
  fetchOpenAiWithTimeout,
  OpenAiUpstreamTimeoutError,
  openAiTimeoutResponse,
} from '../_shared/openaiFetch.ts';

const MAX_ITEMS = 50;
const MAX_STORE_TYPE = 80;
const MAX_ZONE_LABEL = 120;
/** Per-user OpenAI HTTP calls (not cache hits). */
const MAX_OPENAI_CALLS_PER_HOUR = 35;
const MAX_OPENAI_CALLS_PER_DAY = 200;

const RequestSchema = z.object({
  items: z.array(z.string().max(MAX_ITEM_STRING)).max(MAX_ITEMS),
  storeType: z.string().max(MAX_STORE_TYPE).optional(),
  /** Human-readable section names in walking order for this store (from the app). */
  zoneLabelsInOrder: z.array(z.string().max(MAX_ZONE_LABEL)).max(30).optional(),
});

type Result = { input: string; normalized_name: string; category: string; zone_key: string; confidence: number };

function incrementSourceCount(counts: Record<string, number>, source: string, by = 1): void {
  counts[source] = (counts[source] ?? 0) + by;
}

function expandResultsToRawOrder(
  rawItems: string[],
  uniqueInputs: string[],
  resultsByIndex: (Result | null)[]
): Result[] {
  const map = new Map<string, Result>();
  for (let i = 0; i < uniqueInputs.length; i++) {
    const r = resultsByIndex[i];
    if (r) map.set(uniqueInputs[i], r);
  }
  return rawItems.map((raw) => {
    const n = normalize(raw);
    const r = map.get(n);
    if (r) return { ...r, input: raw };
    return {
      input: raw,
      normalized_name: n,
      category: 'other',
      zone_key: 'other',
      confidence: 0,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      console.error('categorize-items: SUPABASE_SERVICE_ROLE_KEY missing');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authUserError,
    } = await supabaseUser.auth.getUser();
    if (authUserError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      console.error('categorize-items: invalid body', parsed.error.flatten());
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { items: rawItems, zoneLabelsInOrder } = parsed.data;
    const normalizedInputs = rawItems.map((s) => normalize(s));
    const seen = new Map<string, string>();
    const uniqueInputs: string[] = [];
    for (let i = 0; i < normalizedInputs.length; i++) {
      const n = normalizedInputs[i];
      if (!seen.has(n)) {
        seen.set(n, rawItems[i]);
        uniqueInputs.push(n);
      }
    }

    const resultsByIndex: (Result | null)[] = new Array(uniqueInputs.length);
    let cacheMissInputs: string[] = [];
    let cacheMissIndices: number[] = [];
    const sourceCounts: Record<string, number> = {};

    // Batched cache read: one round-trip for all unique inputs instead of one per item.
    // For a 10-item Smart Add this collapses 10 SELECTs into a single .in(...) query and
    // shaves hundreds of milliseconds from p50 latency.
    type CachedRow = {
      input_text: string;
      normalized_name: string;
      category: string;
      zone_key: string;
      confidence: number | string | null;
      updated_at?: string;
    };

    let cachedByInput: Map<string, CachedRow> = new Map();
    if (uniqueInputs.length > 0) {
      const { data: cachedRows } = await supabaseUser
        .from('ai_item_cache')
        .select('input_text, normalized_name, category, zone_key, confidence')
        .in('input_text', uniqueInputs);
      if (Array.isArray(cachedRows)) {
        for (const row of cachedRows as CachedRow[]) {
          if (row?.input_text) cachedByInput.set(row.input_text, row);
        }
      }
    }

    for (let i = 0; i < uniqueInputs.length; i++) {
      const inputText = uniqueInputs[i];
      const cached = cachedByInput.get(inputText) ?? null;

      const conf = Number(cached?.confidence ?? 0);
      // Re-run OpenAI when cache only has low-confidence "other" (bad keys, old parses, or defaults).
      const useCache =
        cached &&
        !(
          cached.zone_key === 'other' &&
          (conf <= 0.55 || Number.isNaN(conf))
        );

      if (useCache && cached) {
        resultsByIndex[i] = {
          input: seen.get(inputText) ?? inputText,
          normalized_name: cached.normalized_name,
          category: cached.category,
          zone_key: cached.zone_key,
          confidence: Number(cached.confidence ?? 0.9),
        };
        incrementSourceCount(sourceCounts, 'edge_cache');
      } else {
        cacheMissInputs.push(inputText);
        cacheMissIndices.push(i);
      }
    }

    const deterministicCachePayloads: {
      input_text: string;
      normalized_name: string;
      category: string;
      zone_key: string;
      confidence: number;
      updated_at: string;
    }[] = [];

    if (cacheMissInputs.length > 0) {
      const nextMissInputs: string[] = [];
      const nextMissIndices: number[] = [];
      const nowIso = new Date().toISOString();

      for (let j = 0; j < cacheMissInputs.length; j++) {
        const inputText = cacheMissInputs[j];
        const deterministic = resolveCommonGroceryCategory(inputText);
        if (deterministic) {
          const idx = cacheMissIndices[j];
          resultsByIndex[idx] = {
            input: seen.get(inputText) ?? inputText,
            normalized_name: deterministic.normalized_name,
            category: deterministic.category,
            zone_key: deterministic.zone_key,
            confidence: deterministic.confidence,
          };
          deterministicCachePayloads.push({
            input_text: inputText,
            normalized_name: deterministic.normalized_name,
            category: deterministic.category,
            zone_key: deterministic.zone_key,
            confidence: deterministic.confidence,
            updated_at: nowIso,
          });
          incrementSourceCount(sourceCounts, 'edge_catalog');
        } else {
          nextMissInputs.push(inputText);
          nextMissIndices.push(cacheMissIndices[j]);
        }
      }

      cacheMissInputs = nextMissInputs;
      cacheMissIndices = nextMissIndices;
    }

    if (deterministicCachePayloads.length > 0) {
      const { error: deterministicCacheError } = await supabaseAdmin
        .from('ai_item_cache')
        .upsert(deterministicCachePayloads, { onConflict: 'input_text' });
      if (deterministicCacheError) {
        console.error('categorize-items: deterministic cache upsert failed', deterministicCacheError);
      }
    }

    if (cacheMissInputs.length > 0) {
      const fuzzyTokens = tokensForFuzzyCacheLookup(cacheMissInputs);
      let fuzzyRows: CachedRow[] = [];
      if (fuzzyTokens.length > 0) {
        const orClause = fuzzyTokens.map((t) => `normalized_name.ilike.%${t}%`).join(',');
        const { data } = await supabaseUser
          .from('ai_item_cache')
          .select('input_text, normalized_name, category, zone_key, confidence, updated_at')
          .or(orClause)
          .order('updated_at', { ascending: false })
          .order('normalized_name', { ascending: true })
          .limit(200);
        if (Array.isArray(data)) fuzzyRows = data as CachedRow[];
      }
      const fuzzyEntries = fuzzyRows
        .filter((row) => {
          const conf = Number(row.confidence ?? 0);
          return (
            row.normalized_name &&
            row.category &&
            row.zone_key &&
            !(row.zone_key === 'other' && (conf <= 0.55 || Number.isNaN(conf)))
          );
        })
        .sort((a, b) => {
          const byName = a.normalized_name.localeCompare(b.normalized_name);
          if (byName !== 0) return byName;
          return String(a.updated_at ?? '').localeCompare(String(b.updated_at ?? ''));
        })
        .map((row) => ({
          normalized_name: row.normalized_name,
          category: row.category,
          zone_key: row.zone_key as ZoneKey,
        }));

      if (fuzzyEntries.length > 0) {
        const nextMissInputs: string[] = [];
        const nextMissIndices: number[] = [];
        for (let j = 0; j < cacheMissInputs.length; j++) {
          const inputText = cacheMissInputs[j];
          const fuzzy = resolveFromCategoryEntries(inputText, fuzzyEntries);
          if (fuzzy) {
            const idx = cacheMissIndices[j];
            resultsByIndex[idx] = {
              input: seen.get(inputText) ?? inputText,
              normalized_name: fuzzy.normalized_name,
              category: fuzzy.category,
              zone_key: fuzzy.zone_key,
              confidence: fuzzy.confidence,
            };
            incrementSourceCount(sourceCounts, 'edge_cache');
          } else {
            nextMissInputs.push(inputText);
            nextMissIndices.push(cacheMissIndices[j]);
          }
        }
        cacheMissInputs = nextMissInputs;
        cacheMissIndices = nextMissIndices;
      }
    }

    if (cacheMissInputs.length > 0) {
      const isPremium = await fetchUserPremiumActive(supabaseAdmin, user.id);
      if (!isPremium) {
        for (let j = 0; j < cacheMissInputs.length; j++) {
          const inputText = cacheMissInputs[j];
          const idx = cacheMissIndices[j];
          const normalized_name = normalize(inputText);
          resultsByIndex[idx] = {
            input: seen.get(inputText) ?? inputText,
            normalized_name,
            category: 'other',
            zone_key: 'other',
            confidence: 0.35,
          };
          incrementSourceCount(sourceCounts, 'free_tier_fallback');
        }
      } else {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) {
        console.error('categorize-items: OPENAI_API_KEY missing');
        return new Response(JSON.stringify({ error: 'Classification service unavailable' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count: hourCount, error: hourErr } = await supabaseAdmin
        .from('categorize_openai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('called_at', hourAgo);

      const { count: dayCount, error: dayErr } = await supabaseAdmin
        .from('categorize_openai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('called_at', dayAgo);

      if (hourErr || dayErr) {
        console.error('categorize-items: rate limit count failed', hourErr ?? dayErr);
        return new Response(JSON.stringify({ error: 'Classification service unavailable' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if ((hourCount ?? 0) >= MAX_OPENAI_CALLS_PER_HOUR || (dayCount ?? 0) >= MAX_OPENAI_CALLS_PER_DAY) {
        return new Response(
          JSON.stringify({ error: 'Too many requests', code: 'rate_limited' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const storePath =
        zoneLabelsInOrder && zoneLabelsInOrder.length > 0
          ? ` This store's sections in walking order: ${zoneLabelsInOrder.join(' → ')}. Prefer zone_key that best matches the item to one of these sections (semantic match to the allowed zone_key list below).`
          : '';
      const prompt = `You are a grocery classifier.${storePath} Return a JSON object with a single key "results" whose value is an array of objects. Each object has: normalized_name (lowercase, no brand), category (short string), zone_key (exactly one of: ${ZONE_KEYS.join(', ')}), confidence (0-1).
Examples: salt, black pepper, garlic powder, soy sauce, olive oil → zone_key pantry; bell pepper, fresh garlic, lemons → zone_key produce.
One object per item, in the same order as the list. No other keys or text.
Items to classify:
${cacheMissInputs.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

      let openaiRes: Response;
      try {
        openaiRes = await fetchOpenAiWithTimeout('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            // Deterministic classification → fewer malformed JSON retries, tighter p99.
            temperature: 0,
            // Roughly ~60 tokens per item for the JSON row + a fixed envelope.
            max_tokens: Math.min(4000, 60 * cacheMissInputs.length + 120),
          }),
        });
      } catch (e) {
        if (e instanceof OpenAiUpstreamTimeoutError) {
          return openAiTimeoutResponse(corsHeaders);
        }
        throw e;
      }

      if (!openaiRes.ok) {
        const err = await openaiRes.text();
        console.error('categorize-items: OpenAI HTTP', openaiRes.status, err.slice(0, 500));
        return new Response(JSON.stringify({ error: 'Classification service unavailable' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const openaiData = await openaiRes.json();
      const content = openaiData.choices?.[0]?.message?.content;
      if (!content) {
        console.error('categorize-items: empty OpenAI content');
        return new Response(JSON.stringify({ error: 'Classification service unavailable' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let arr: unknown[];
      try {
        const obj = JSON.parse(content);
        arr = Array.isArray(obj?.results) ? obj.results : Array.isArray(obj) ? obj : [];
      } catch {
        console.error('categorize-items: invalid JSON from OpenAI');
        return new Response(JSON.stringify({ error: 'Classification service unavailable' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build per-row results synchronously, then flush all writes in parallel.
      // Prior implementation awaited N upserts + 1 usage log serially (~11 round-trips for
      // a 10-item Smart Add); the batched upsert collapses those to a single DB call and
      // the usage log runs concurrently in the same Promise.all.
      const nowIso = new Date().toISOString();
      const cachePayloads: {
        input_text: string;
        normalized_name: string;
        category: string;
        zone_key: string;
        confidence: number;
        updated_at: string;
      }[] = [];

      for (let j = 0; j < cacheMissInputs.length; j++) {
        const raw = arr[j];
        const inputText = cacheMissInputs[j];
        const { normalized_name, category, zone_key, confidence } = parseOpenAiRow(raw, inputText);

        cachePayloads.push({
          input_text: inputText,
          normalized_name,
          category,
          zone_key,
          confidence,
          updated_at: nowIso,
        });

        const idx = cacheMissIndices[j];
        resultsByIndex[idx] = {
          input: seen.get(inputText) ?? inputText,
          normalized_name,
          category,
          zone_key,
          confidence,
        };
        incrementSourceCount(sourceCounts, 'openai');
      }

      const [upsertRes, logRes] = await Promise.all([
        cachePayloads.length > 0
          ? supabaseAdmin
              .from('ai_item_cache')
              .upsert(cachePayloads, { onConflict: 'input_text' })
          : Promise.resolve({ error: null as null | { message?: string } }),
        supabaseAdmin.from('categorize_openai_usage').insert({ user_id: user.id }),
      ]);

      if (upsertRes.error) {
        console.error('categorize-items: cache upsert failed', upsertRes.error);
      }
      if (logRes.error) {
        console.error('categorize-items: failed to log OpenAI usage', logRes.error);
      }
      }
    }

    const results = expandResultsToRawOrder(rawItems, uniqueInputs, resultsByIndex);
    const cacheHits = uniqueInputs.length - cacheMissInputs.length;

    return new Response(
      JSON.stringify({
        results,
        cache_hits: cacheHits,
        cache_misses: cacheMissInputs.length,
        source_counts: sourceCounts,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('categorize-items:', e);
    return new Response(JSON.stringify({ error: 'Classification failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
