import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { assertPlacesRateAllowed } from '../_shared/placesRateLimit.ts';

const MAX_WIDTH = 256;
const MAX_REF_LEN = 512;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
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

    try {
      await assertPlacesRateAllowed(supabaseUrl, user.id, 'place-photo');
    } catch (rlErr) {
      if (rlErr instanceof Error && rlErr.message === 'PLACES_RATE_LIMIT') {
        return new Response(JSON.stringify({ error: 'Too many requests. Try again shortly.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw rlErr;
    }

    const url = new URL(req.url);
    const photoRef = url.searchParams.get('photo_reference')?.trim() ?? '';
    if (!photoRef || photoRef.length > MAX_REF_LEN || /[\r\n]/.test(photoRef)) {
      return new Response(JSON.stringify({ error: 'Invalid photo_reference' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      console.error('place-photo: GOOGLE_PLACES_API_KEY missing');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const photoUrl = new URL('https://maps.googleapis.com/maps/api/place/photo');
    photoUrl.searchParams.set('maxwidth', String(MAX_WIDTH));
    photoUrl.searchParams.set('photo_reference', photoRef);
    photoUrl.searchParams.set('key', apiKey);

    const imgRes = await fetch(photoUrl.toString());
    if (!imgRes.ok) {
      console.error('place-photo: Google status', imgRes.status);
      return new Response(JSON.stringify({ error: 'Image unavailable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buf = await imgRes.arrayBuffer();

    return new Response(buf, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800',
      },
    });
  } catch (e) {
    console.error('place-photo:', e);
    return new Response(JSON.stringify({ error: 'Photo request failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
