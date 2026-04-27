import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type PlacesFn = 'place-search' | 'places-nearby' | 'place-photo';

const DEFAULT_LIMITS: Record<PlacesFn, number> = {
  'place-search': 90,
  'places-nearby': 45,
  'place-photo': 120,
};

const ENV_KEYS: Record<PlacesFn, string> = {
  'place-search': 'PLACES_RATE_PLACE_SEARCH_PER_MIN',
  'places-nearby': 'PLACES_RATE_PLACES_NEARBY_PER_MIN',
  'place-photo': 'PLACES_RATE_PLACE_PHOTO_PER_MIN',
};

function parseLimit(fn: PlacesFn): number {
  const raw = Deno.env.get(ENV_KEYS[fn]);
  if (!raw) return DEFAULT_LIMITS[fn];
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_LIMITS[fn];
}

type RpcRow = { allowed: boolean; current_count: number };

function rowFromRpc(data: unknown): RpcRow | null {
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    const o = data[0] as Record<string, unknown>;
    if (typeof o.allowed === 'boolean' && typeof o.current_count === 'number') {
      return { allowed: o.allowed, current_count: o.current_count };
    }
  }
  return null;
}

/**
 * Enforces per-user per-minute quota via Postgres (migration 022).
 * If service role key is missing or RPC fails, logs and allows (backward compatible).
 */
export async function assertPlacesRateAllowed(
  supabaseUrl: string,
  userId: string,
  fn: PlacesFn
): Promise<void> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) {
    console.warn(`${fn}: SUPABASE_SERVICE_ROLE_KEY missing; per-user rate limit skipped`);
    return;
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const limit = parseLimit(fn);

  const { data, error } = await admin.rpc('places_rate_limit_consume', {
    p_user_id: userId,
    p_fn: fn,
    p_limit: limit,
  });

  if (error) {
    console.error(`${fn}: places_rate_limit_consume error`, error.message);
    return;
  }

  const row = rowFromRpc(data);
  if (!row) {
    console.error(`${fn}: unexpected RPC shape`, JSON.stringify(data));
    return;
  }

  if (!row.allowed) {
    console.warn(`${fn}: rate limit exceeded user=${userId} count=${row.current_count} limit=${limit}`);
    throw new Error('PLACES_RATE_LIMIT');
  }
}
