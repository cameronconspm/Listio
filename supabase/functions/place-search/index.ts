import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';
import { assertPlacesRateAllowed } from '../_shared/placesRateLimit.ts';

const BodySchema = z.object({
  q: z.string().min(1).max(200),
});

export type PlaceSearchResult = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  address: string;
};

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
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
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

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      console.error('place-search: invalid body', parsed.error.flatten());
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const q = parsed.data.q.trim();
    if (q.length < 2) {
      return new Response(JSON.stringify({ results: [] as PlaceSearchResult[] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      await assertPlacesRateAllowed(supabaseUrl, user.id, 'place-search');
    } catch (rlErr) {
      if (rlErr instanceof Error && rlErr.message === 'PLACES_RATE_LIMIT') {
        return new Response(JSON.stringify({ error: 'Too many requests. Try again shortly.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw rlErr;
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      console.error('place-search: GOOGLE_PLACES_API_KEY missing');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${apiKey}`;
    const geoRes = await fetch(url);
    const geoJson = (await geoRes.json()) as {
      results?: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        place_id: string;
      }>;
      status: string;
    };

    if (geoJson.status !== 'OK' && geoJson.status !== 'ZERO_RESULTS') {
      console.error('place-search: geocode status', geoJson.status);
      return new Response(JSON.stringify({ error: 'Search unavailable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: PlaceSearchResult[] = (geoJson.results ?? []).slice(0, 8).map((r) => ({
      id: r.place_id,
      title: r.formatted_address,
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
      address: r.formatted_address,
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('place-search:', e);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
