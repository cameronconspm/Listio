#!/usr/bin/env node
/**
 * Repo-side checks before release: Edge functions reference the expected secret
 * and config.toml lists place-search / places-nearby.
 * Does not call Supabase or GCP (use dashboard for secrets and API enablement).
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = false;

function check(cond, msg) {
  if (!cond) {
    console.error(`[verify-location-backend] ${msg}`);
    failed = true;
  }
}

const placeSearch = fs.readFileSync(
  path.join(root, 'supabase/functions/place-search/index.ts'),
  'utf8'
);
const placesNearby = fs.readFileSync(
  path.join(root, 'supabase/functions/places-nearby/index.ts'),
  'utf8'
);
const placePhoto = fs.readFileSync(
  path.join(root, 'supabase/functions/place-photo/index.ts'),
  'utf8'
);

check(placeSearch.includes("Deno.env.get('GOOGLE_PLACES_API_KEY')"), 'place-search must read GOOGLE_PLACES_API_KEY');
check(placesNearby.includes("Deno.env.get('GOOGLE_PLACES_API_KEY')"), 'places-nearby must read GOOGLE_PLACES_API_KEY');
check(placePhoto.includes("Deno.env.get('GOOGLE_PLACES_API_KEY')"), 'place-photo must read GOOGLE_PLACES_API_KEY');

const configToml = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
check(configToml.includes('[functions.place-search]'), 'config.toml must include [functions.place-search]');
check(configToml.includes('[functions.places-nearby]'), 'config.toml must include [functions.places-nearby]');
check(configToml.includes('[functions.place-photo]'), 'config.toml must include [functions.place-photo]');

const migration022 = fs.readFileSync(
  path.join(root, 'supabase/migrations/022_places_edge_rate_limit.sql'),
  'utf8'
);
check(
  migration022.includes('places_rate_limit_consume'),
  'migration 022 must define places_rate_limit_consume'
);

const migrationPlacePhoto = fs.readFileSync(
  path.join(root, 'supabase/migrations/030_place_photo_rate_limit.sql'),
  'utf8'
);
check(migrationPlacePhoto.includes("'place-photo'"), 'place-photo rate-limit migration must allow place-photo rate bucket');

if (failed) {
  console.error('\nSet the secret on the Supabase project: supabase secrets set GOOGLE_PLACES_API_KEY=...');
  console.error('Enable Geocoding API + Places Nearby Search + Place Photo on GCP; deploy place-search, places-nearby, place-photo.');
  process.exit(1);
}

console.log(
  'Location backend repo checks passed (place-search, places-nearby, place-photo, GOOGLE_PLACES_API_KEY references).'
);
console.log('Confirm live project: supabase secrets list | grep GOOGLE_PLACES_API_KEY');
process.exit(0);
