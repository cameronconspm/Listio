# Listio

Grocery and household list app with meal planning, recipes, and store-zone–based grouping. iOS-first, with an Apple-like “Liquid Glass” visual style and AI-powered item categorization.

## Features

- **List**: Add items (paste or type) → AI categorizes by store zone → list grouped by your store layout. Check off as you shop, swipe to delete.
- **Meals**: Plan meals with date ranges and ingredients. “Add missing to list” merges quantities and links items to meals.
- **Recipes**: Save recipes with ingredients. “Add to meals” creates a meal from a recipe; “Add ingredients to list” pushes missing items to the list.
- **Store**: Choose store type and reorder zones to match your usual path.
- **Settings**: Default store, units (coming soon), account / logout.

## Stack

- **Frontend**: Expo, React Native, TypeScript
- **Backend**: Supabase (Auth, Postgres, RLS, Edge Functions)
- **AI**: Supabase Edge Function calling OpenAI to classify items into zones, with caching

## Prerequisites

- Node 18+
- npm or yarn
- Expo CLI (`npx expo` is enough)
- Supabase account
- iOS simulator or device (Android supported but not primary for MVP)

## Configuration

The app **requires** Supabase: set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`. If either is missing, startup shows a configuration screen instead of the login flow.

Users **sign in or create an account**; the main app appears only with an active Supabase session (after onboarding). Data is cloud-backed (Postgres + RLS). Some service modules still contain AsyncStorage fallbacks for tests or edge cases, but the shipped app path is cloud-only.

## Environment variables

| Source   | Variable                         | Purpose                    |
|----------|----------------------------------|----------------------------|
| App `.env` | `EXPO_PUBLIC_SUPABASE_URL`       | Supabase project URL       |
| App `.env` | `EXPO_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anon key           |
| App `.env` | `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` | Google Maps SDK key for **Android** maps (`react-native-maps`); used at prebuild |
| Supabase secrets | `OPENAI_API_KEY`         | Edge Function → OpenAI API |
| Supabase secrets | `GOOGLE_PLACES_API_KEY` | Edge Functions `place-search` (Geocoding API) and `places-nearby` (Places Nearby Search); server-side only, not in the app |

`SUPABASE_SERVICE_ROLE_KEY` is **automatically** available to hosted Edge Functions; the `categorize-items` function uses it to write the shared `ai_item_cache` table (clients only have read access via RLS).

## Supabase setup

1. **Create a project** at [supabase.com](https://supabase.com).

2. **Run migrations** in order (Supabase Dashboard → SQL Editor, or CLI `supabase db push`):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_triggers_seed.sql`
   - `supabase/migrations/004_item_metadata.sql`
   - `supabase/migrations/005_meals_planner_schema.sql` — **required for Meals** (`meal_date`, `meal_slot`, planner columns on `meals`; ingredient columns on `meal_ingredients`)
   - `supabase/migrations/006_recipe_optional.sql`
   - `supabase/migrations/007_recipe_favorites_category.sql`
   - `supabase/migrations/008_store_aisle_order_notes.sql`
   - `supabase/migrations/009_user_preferences_and_ai_cache_rls.sql` — **user settings JSON** + tightens `ai_item_cache` writes (Edge Function only)
   - `supabase/migrations/010_households.sql` through `016_household_rls_no_recursion.sql` — households, invites, household-scoped RLS (required for shared lists)
   - `supabase/migrations/017_user_push_tokens.sql` — Expo push tokens per user (remote notifications)
   - `supabase/migrations/018_household_push_log.sql` — rate limiting for household push notifications
   - `supabase/migrations/020_text_length_limits.sql` — max lengths on user-editable text + `user_preferences.payload` size
   - `supabase/migrations/021_categorize_openai_usage.sql` — per-user OpenAI call logging for `categorize-items` rate limits
   - `supabase/migrations/022_places_edge_rate_limit.sql` — per-user per-minute buckets for `place-search` / `places-nearby` (Edge + `SUPABASE_SERVICE_ROLE_KEY`)
   - `supabase/migrations/023_parse_recipe_rate_limit_and_cache.sql` — usage logging + cache table for `parse-recipe` rate limits and spend control

   **Re-running `002`**: `CREATE POLICY` is not idempotent. If policies already exist, drop them by name first (see policy names inside `002_rls_policies.sql`) or apply only the newer migrations on top of an existing project.

3. **Deploy Edge Functions**  
   Using Supabase CLI (install from [supabase.com/docs](https://supabase.com/docs)):
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy categorize-items
   supabase functions deploy parse-recipe
   supabase functions deploy place-search
   supabase functions deploy places-nearby
   supabase functions deploy household-push
   ```

   **JWT verification (Kong)** is configured in [`supabase/config.toml`](supabase/config.toml): `categorize-items` and `places-nearby` use **`verify_jwt = false`** because the API gateway was returning **401 Invalid JWT** even when Auth accepted the same token; those functions still require a valid **`Authorization` header** and run **`getUser()`** inside the function. **`place-search`** keeps **`verify_jwt = true`**. For **`household-push`**, JWT verification must stay **off** (Database Webhooks with a shared secret, not the mobile client).

4. **Household push (optional)**  
   After deploying `household-push`, set a webhook secret and expose it to the function:
   ```bash
   supabase secrets set HOUSEHOLD_PUSH_WEBHOOK_SECRET=your-long-random-secret
   ```
   In **Supabase Dashboard → Database → Webhooks**, create a webhook on `public.list_items` for **Insert** and **Update** that POSTs to:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/household-push`  
   Add header `x-webhook-secret: your-long-random-secret` (same value as above). The function notifies other household members by Expo push when the shared list changes (rate-limited per household).

5. **Set secrets**:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key
   supabase secrets set GOOGLE_PLACES_API_KEY=your-google-server-key
   ```

   Optional **per-user rate limits** (defaults apply if unset):  
   `supabase secrets set PLACES_RATE_PLACE_SEARCH_PER_MIN=90`  
   `supabase secrets set PLACES_RATE_PLACES_NEARBY_PER_MIN=45`  
   `supabase secrets set PARSE_RECIPE_PER_HOUR_LIMIT=10`  
   `supabase secrets set PARSE_RECIPE_PER_DAY_LIMIT=40`  
   `supabase secrets set PARSE_RECIPE_GLOBAL_PER_HOUR_LIMIT=5000`  
   `supabase secrets set PARSE_RECIPE_CACHE_TTL_SECONDS=1209600`  

   Hosted Edge Functions receive **`SUPABASE_SERVICE_ROLE_KEY`** automatically; local `supabase functions serve` needs it in `supabase/.env` or the CLI environment for rate limiting to run. If the key is missing, functions **log a warning** and skip the quota check (not recommended for production).

   For **Google Cloud** (same key in the secret): enable **billing**, **Geocoding API** (`place-search`), and **Places API** with **Nearby Search** (`places-nearby`). Restrict the key by **API** (Geocoding + Places); use **application restrictions** that allow **server** calls from Supabase Edge (Android/iOS app–restricted keys often return `REQUEST_DENIED` from Edge). For **Android** in-app maps only, use a separate key: **Maps SDK for Android** in `.env` as `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`.

   **Places API lifecycle:** legacy Nearby Search + Geocoding are documented in [`supabase/functions/PLACES_API_NOTES.md`](supabase/functions/PLACES_API_NOTES.md); plan a server-side move to **Places API (New)** when Google deprecates the REST endpoints you use.

6. **Security (operations)**  
   Keep **service role** and **OpenAI** keys only in Supabase secrets / Edge Functions—never in the mobile app. Use the Supabase Dashboard for **Auth** hardening (email confirmation, leaked-password protection) and review **API** restrictions on the anon key. After pulling new migrations, run **`020`**, **`021`**, and **`022`** so text limits, `categorize_openai_usage`, and place Edge rate limits exist before deploying updated functions. In the **OpenAI** dashboard, set **budget alerts** and usage limits as a backup to app-side rate limits.

7. **iOS privacy manifest**  
   [`app.json`](app.json) sets `expo.ios.privacyManifests`: **precise location** (app functionality, not used for tracking) plus required-reason entries aligned with Expo pods (`UserDefaults` / file timestamp / system boot time). Adjust if Apple or Expo guidance changes after a submission.

8. **Maps / store location (development build)**
   `react-native-maps` is a native module: use a **development build** (`npx expo prebuild` or EAS Build), not Expo Go. Set `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` before prebuild so Android embeds the key (see [Expo MapView](https://docs.expo.dev/versions/latest/sdk/map-view/)). iOS uses Apple MapKit without an extra key.
   The local package `modules/expo-apple-places-search` adds **MKLocalSearch** on iPhone for address suggestions in store edit; it is included in the dev build via autolinking. In **Expo Go**, that module is absent and the app falls back to the Edge Function (when signed in) or `expo-location` geocoding.

## App Store Connect (subscriptions & review)

- **IAP builds:** Submit iOS binaries built with **`production`** or **`app-store-review`** (both enforce subscriptions). Set `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` on EAS. Use EAS profile **`internal-no-iap`** only for internal/simulator builds that must skip billing—**not** for App Store review.
- **TestFlight QA tools:** EAS profile **`testflight-qa`** extends production and sets `EXPO_PUBLIC_ENABLE_QA_SETTINGS_TOOLS=1` so Profile shows **Demo** (e.g. Show paywall) for any tester. Do not ship that profile to App Store review or production if you want to hide those rows from all users.
- **Review steps to share with Apple:** Sign in → complete onboarding → **Subscription required** screen → **View plans** (monthly/annual), or **Profile → Plans & pricing**.
- **Support URL (Guideline 1.5):** Use a working help page, e.g. `https://thelistioapp.com/help` (same URL as in-app Help center), not a bare marketing homepage.
- **Privacy Policy field:** `https://thelistioapp.com/privacy-policy` (must load in a browser).
- **Terms of Use / EULA (Guideline 3.1.2):** Either add your custom terms link to the **App Description** and/or **EULA** field in App Store Connect (`https://thelistioapp.com/terms-and-conditions`), or include Apple’s standard EULA link if you rely on it: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
- **Agreements:** The **Account Holder** must accept the **Paid Apps Agreement** before paid IAP works in sandbox/review.

## Local → cloud import

If you used local-only mode (`local-user` data in AsyncStorage) and then sign in with sync enabled, the app **automatically** imports that device data into the empty account (stores → recipes → meals → list items, preserving IDs). If the account already has synced rows, import is skipped. After a successful import, local entity storage is cleared.

## App setup

1. Clone the repo and install dependencies:
   ```bash
   cd Listio
   npm install
   ```

2. Copy env template and fill in your values:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `EXPO_PUBLIC_SUPABASE_URL` – e.g. `https://xxxxx.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` – your project’s anon key
   - `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` – only if you build Android with **Adjust on map** / maps (development build + prebuild)

3. Start the app:
   ```bash
   npx expo start
   ```
   Then press `i` for iOS simulator or scan the QR code with Expo Go.

4. **Test account** – On the login screen, tap **Sign in with test account** to use `test@listio.app` / `TestPass123!`. The first tap creates the account if it doesn’t exist (disable “Confirm email” in Supabase Auth settings for instant use).

## Scripts

- `npm start` – start Expo dev server
- `npm run ios` – run on iOS
- `npm run lint` – run ESLint
- `npm run format` – run Prettier
- `npm test` – run Jest tests

## Optional: CI

Example GitHub Actions step to run lint and tests:

```yaml
- run: npm ci
- run: npm run lint
- run: npm test
```

## Project structure

- `src/` – app code
  - `app/`, `navigation/` – entry and navigation
  - `screens/` – auth, home, meals, recipes, store, settings
  - `components/` – shared UI and feature components
  - `design/` – tokens, theme, typography, spacing
  - `services/` – Supabase client, AI, list, meal, recipe, store
  - `state/`, `data/`, `utils/`, `types/`, `hooks/`
- `supabase/migrations/` – SQL migrations
- `supabase/functions/categorize-items/`, `supabase/functions/place-search/` – Edge Functions
- `__tests__/` – Jest unit tests (e.g. parseItems, normalize, quantities)
