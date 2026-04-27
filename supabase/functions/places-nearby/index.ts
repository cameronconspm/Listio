import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import { corsHeaders } from '../_shared/cors.ts';
import { assertPlacesRateAllowed } from '../_shared/placesRateLimit.ts';
import { isLikelyGroceryShoppingPlace } from '../_shared/groceryPlaceClassification.ts';

const BodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().min(100).max(50000).optional(),
});

export type PlaceSearchResult = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  address: string;
  /** Google Places types (for client-side validation / debugging). */
  types?: string[];
  /** Nearby Search `icon` — category pin; used only if no place photo. */
  iconUrl?: string;
  iconBackgroundColor?: string;
  /** First Place Photo reference (Nearby or Details); load via `place-photo` Edge function. */
  photoReference?: string;
  /** Plain text from first photo attribution (Google policy). */
  photoAttributionText?: string;
};

function stripHtmlBasic(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function mergePlaceRows(prev: PlaceSearchResult, next: PlaceSearchResult): PlaceSearchResult {
  const a = prev.address.trim();
  const b = next.address.trim();
  return {
    ...prev,
    address: b.length > a.length ? next.address : prev.address,
    types: prev.types?.length ? prev.types : next.types,
    iconUrl: prev.iconUrl ?? next.iconUrl,
    iconBackgroundColor: prev.iconBackgroundColor ?? next.iconBackgroundColor,
    photoReference: prev.photoReference ?? next.photoReference,
    photoAttributionText: prev.photoAttributionText ?? next.photoAttributionText,
  };
}

/** Up to this many closest results may get an extra Place Details request for photos. */
const DETAILS_PHOTO_ENRICH_COUNT = 5;

async function fetchFirstPhotoFromDetails(
  apiKey: string,
  placeId: string
): Promise<{ photoReference?: string; photoAttributionText?: string }> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'photos',
    key: apiKey,
  });
  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    result?: {
      photos?: Array<{ photo_reference?: string; html_attributions?: string[] }>;
    };
    status: string;
  };
  if (json.status !== 'OK') {
    if (json.status !== 'NOT_FOUND' && json.status !== 'INVALID_REQUEST') {
      console.warn('places-nearby: Place Details', json.status, placeId.slice(0, 12));
    }
    return {};
  }
  const p = json.result?.photos?.[0];
  const ref = p?.photo_reference;
  const html0 = p?.html_attributions?.[0];
  if (typeof ref !== 'string' || ref.length === 0) return {};
  return {
    photoReference: ref,
    photoAttributionText: typeof html0 === 'string' ? stripHtmlBasic(html0) : undefined,
  };
}

/** Keep in sync with `NEAREST_STORE_SUGGEST_MAX_M` in app `src/utils/geo.ts` (~10 mi). */
const DEFAULT_RADIUS_M = Math.round(10 * 1609.344);

/**
 * Google Places Nearby Search (legacy REST).
 * See supabase/functions/PLACES_API_NOTES.md for migrating to Places API (New).
 */
async function fetchNearbyForType(
  apiKey: string,
  lat: number,
  lng: number,
  radius: number,
  type: string
): Promise<PlaceSearchResult[]> {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(Math.round(radius)),
    type,
    key: apiKey,
  });
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    results?: Array<{
      place_id: string;
      name: string;
      vicinity?: string;
      types?: string[];
      icon?: string;
      icon_background_color?: string;
      photos?: Array<{ photo_reference?: string; html_attributions?: string[] }>;
      geometry?: { location: { lat: number; lng: number } };
    }>;
    status: string;
  };

  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    console.error('places-nearby: Google status', json.status);
    return [];
  }

  const rows: PlaceSearchResult[] = [];
  for (const r of json.results ?? []) {
    const loc = r.geometry?.location;
    if (!loc) continue;
    if (!isLikelyGroceryShoppingPlace(r.types, r.name)) continue;
    const firstPhoto = r.photos?.[0];
    const pref = firstPhoto?.photo_reference;
    const html0 = firstPhoto?.html_attributions?.[0];
    rows.push({
      id: r.place_id,
      title: r.name,
      latitude: loc.lat,
      longitude: loc.lng,
      address: r.vicinity?.trim() || r.name,
      types: r.types,
      iconUrl: typeof r.icon === 'string' && r.icon.length > 0 ? r.icon : undefined,
      iconBackgroundColor:
        typeof r.icon_background_color === 'string' && r.icon_background_color.length > 0
          ? r.icon_background_color
          : undefined,
      photoReference: typeof pref === 'string' && pref.length > 0 ? pref : undefined,
      photoAttributionText:
        typeof html0 === 'string' && html0.length > 0 ? stripHtmlBasic(html0) : undefined,
    });
  }
  return rows;
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
      console.error('places-nearby: invalid body', parsed.error.flatten());
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { lat, lng } = parsed.data;
    const radiusM = parsed.data.radiusM ?? DEFAULT_RADIUS_M;

    try {
      await assertPlacesRateAllowed(supabaseUrl, user.id, 'places-nearby');
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
      console.error('places-nearby: GOOGLE_PLACES_API_KEY missing');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [a, b, c, d] = await Promise.all([
      fetchNearbyForType(apiKey, lat, lng, radiusM, 'grocery_store'),
      fetchNearbyForType(apiKey, lat, lng, radiusM, 'supermarket'),
      fetchNearbyForType(apiKey, lat, lng, radiusM, 'department_store'),
      fetchNearbyForType(apiKey, lat, lng, radiusM, 'wholesale'),
    ]);

    const byId = new Map<string, PlaceSearchResult>();
    for (const row of [...a, ...b, ...c, ...d]) {
      const prev = byId.get(row.id);
      if (!prev) byId.set(row.id, row);
      else byId.set(row.id, mergePlaceRows(prev, row));
    }

    const sorted = [...byId.values()].sort((x, y) => {
      const dx = haversineM(lat, lng, x.latitude, x.longitude);
      const dy = haversineM(lat, lng, y.latitude, y.longitude);
      return dx - dy;
    });

    const head = sorted.slice(0, DETAILS_PHOTO_ENRICH_COUNT);
    const tail = sorted.slice(DETAILS_PHOTO_ENRICH_COUNT);
    const enrichedHead = await Promise.all(
      head.map(async (row) => {
        if (row.photoReference) return row;
        const extra = await fetchFirstPhotoFromDetails(apiKey, row.id);
        if (!extra.photoReference) return row;
        return { ...row, ...extra };
      })
    );
    const results = [...enrichedHead, ...tail];

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('places-nearby:', e);
    return new Response(JSON.stringify({ error: 'Nearby search failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}
