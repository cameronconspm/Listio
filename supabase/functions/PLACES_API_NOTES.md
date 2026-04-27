# Google Places / Geocoding in Edge Functions

## Current stack

- **`place-search`**: [Geocoding API](https://developers.google.com/maps/documentation/geocoding/overview) (legacy REST `geocode/json`).
- **`places-nearby`**: [Places API — Nearby Search](https://developers.google.com/maps/documentation/places/web-service/search-nearby) (legacy REST `place/nearbysearch/json`), two calls per request (`grocery_store`, `supermarket`).

## Lifecycle / migration

Google is evolving the **Places API (New)**. Monitor official deprecation notices for legacy Nearby Search and Geocoding where applicable.

When migrating server-side:

1. Enable the new **Places API** product in Google Cloud (not only legacy “Places API”).
2. Replace `nearbysearch/json` with [Nearby Search (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search) (`places:searchNearby`), including field masks and billing model changes.
3. Re-test response mapping (`place_id`, display name, lat/lng, address line) against [`PlaceSearchResult`](./places-nearby/index.ts) consumed by the app.
4. Keep the **`GOOGLE_PLACES_API_KEY`** restriction aligned with **server** callers (Supabase Edge egress), not mobile app bundle IDs.

## Rate limits

Per-user per-minute quotas are enforced in Postgres (`022_places_edge_rate_limit.sql`) via `places_rate_limit_consume`. Optional Edge secrets:

- `PLACES_RATE_PLACE_SEARCH_PER_MIN` (default `90`)
- `PLACES_RATE_PLACES_NEARBY_PER_MIN` (default `45`)
