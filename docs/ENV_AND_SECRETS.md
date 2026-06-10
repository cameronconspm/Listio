# Environment Variables & Secrets

> **Maintenance:** When adding env vars, Supabase secrets, or EAS build-time flags, update this document and `.env.example` in the same PR.

Where configuration lives for Listio: mobile app (`.env` / EAS), Supabase Edge secrets, and what must **never** ship in the client.

**Related docs:** [TECH_STACK.md](./TECH_STACK.md) · [RELEASE.md](./RELEASE.md) · [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md)

---

## Quick reference

| Variable / secret | Where to set | Required | In client binary? |
|-------------------|--------------|----------|-------------------|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env`, EAS | Yes | Yes (public) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env`, EAS | Yes | Yes (public) |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | `.env`, EAS | Yes (iOS IAP builds) | Yes (public SDK key) |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` | `.env` (prebuild) | Android maps only | Yes |
| `EXPO_PUBLIC_SENTRY_DSN` | `.env`, EAS | Optional | Yes |
| `EXPO_PUBLIC_PASSWORD_RESET_WEB_URL` | `.env`, EAS | Recommended prod | Yes |
| `OPENAI_API_KEY` | Supabase secrets | Yes (AI features) | **Never** |
| `GOOGLE_PLACES_API_KEY` | Supabase secrets | Yes (store location) | **Never** |
| `REVENUECAT_WEBHOOK_SECRET` | Supabase secrets | Yes (IAP mirror) | **Never** |
| `REVENUECAT_SECRET_API_KEY` | Supabase secrets | Yes (sync + webhook) | **Never** |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto on hosted Edge | Yes (functions) | **Never** |

---

## App environment (`.env`)

Copy from `.env.example`. Loaded by Metro and `app.config.js` into `expo.extra` as fallback.

### Required

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

If either is missing, the app shows the misconfigured screen instead of auth.

### iOS subscriptions

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=<revenuecat-ios-public-key>
```

Without this on iOS production builds, users remain on the subscription gate.

Entitlement id in RevenueCat must match `premium` (`src/constants/subscription.ts`).

### Password reset

```bash
EXPO_PUBLIC_PASSWORD_RESET_WEB_URL=https://thelistioapp.com/auth/reset-password
```

Add the **same HTTPS URL** to Supabase → Authentication → Redirect URLs, plus `listio://auth/reset-password` for native deep links.

If unset, dev builds use `listio://` and Expo Go URLs.

### Optional — observability

```bash
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_SENTRY_DEBUG=1          # dev only
EXPO_PUBLIC_SENTRY_PERF_SAMPLE_RATE=0.05
```

Production EAS sets `SENTRY_DISABLE_AUTO_UPLOAD=true` in `eas.json` so builds succeed without Sentry auth token. Crashes still report at runtime.

### Optional — feature flags

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_LIST_REALTIME=1` | Enable Supabase Realtime list invalidation |
| `EXPO_PUBLIC_OFFLINE_MUTATION_QUEUE=1` | Offline queue storage (replay TBD) |
| `EXPO_PUBLIC_REVENUECAT_VERBOSE_LOGS=1` | DEBUG RevenueCat logs in Metro |
| `EXPO_PUBLIC_FORCE_APP_REVIEW_PROMPT=1` | App review prompt in `__DEV__` |

### Internal / QA only (never App Store production)

| Variable | EAS profile | Effect |
|----------|-------------|--------|
| `EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE=1` | `internal-no-iap` | Skips IAP gate and RevenueCat init |
| `EXPO_PUBLIC_ENABLE_QA_SETTINGS_TOOLS=1` | `testflight-qa` | Profile demo tools for all testers |

CI (`verify-eas-production-safety.js`) fails if these appear on `production` or `app-store-review` profiles.

### Android maps

```bash
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=
```

Embed at **prebuild** time for `react-native-maps`. Separate from server Places key.

### EAS project

```bash
EXPO_PUBLIC_EAS_PROJECT_ID=   # override; default in app.json extra.eas.projectId
```

Sync local `.env` to EAS production:

```bash
npm run eas:sync-env
```

---

## Supabase Edge secrets

Set via CLI (not in repo):

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set GOOGLE_PLACES_API_KEY=...
supabase secrets set REVENUECAT_WEBHOOK_SECRET=<random-long-string>
supabase secrets set REVENUECAT_SECRET_API_KEY=sk_...
```

### Optional rate-limit overrides

```bash
supabase secrets set PLACES_RATE_PLACE_SEARCH_PER_MIN=90
supabase secrets set PLACES_RATE_PLACES_NEARBY_PER_MIN=45
supabase secrets set PARSE_RECIPE_PER_HOUR_LIMIT=10
supabase secrets set PARSE_RECIPE_PER_DAY_LIMIT=40
supabase secrets set PARSE_RECIPE_GLOBAL_PER_HOUR_LIMIT=5000
supabase secrets set PARSE_RECIPE_CACHE_TTL_SECONDS=1209600
```

### Google Cloud (same server key)

Enable billing and APIs:

- **Geocoding API** — `place-search`
- **Places API** (Nearby Search) — `places-nearby`

Restrict by API; app-restricted Android/iOS keys often fail from Edge.

See `supabase/functions/PLACES_API_NOTES.md` for deprecation planning.

### Hosted Edge Functions

`SUPABASE_SERVICE_ROLE_KEY` is injected automatically on Supabase-hosted functions. Local `supabase functions serve` needs it in `supabase/.env`.

---

## Webhook configuration

### RevenueCat → Supabase

- **URL:** `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`
- **Authorization:** `Bearer <REVENUECAT_WEBHOOK_SECRET>`

Verify repo config: `npm run verify:revenuecat-webhook`

---

## EAS build profiles (`eas.json`)

| Profile | Use | Subscription gate | QA tools |
|---------|-----|-------------------|----------|
| `development` | Dev client, internal | Normal | Off |
| `preview` | Internal distribution | Normal | Off |
| `production` | App Store / TestFlight | Enforced | Off |
| `app-store-review` | Extends production | Enforced | Off |
| `testflight-qa` | Extends production | Enforced | **On** |
| `internal-no-iap` | Simulator / internal | **Disabled** | Off |

Production builds must use `production` or `app-store-review` for App Store submission.

---

## Security rules

1. **Never** commit `.env` with real keys.
2. **Never** put OpenAI, Google server, or RevenueCat **secret** keys in Expo env.
3. Anon key is public by design — protect data with **RLS**, not key secrecy.
4. Rotate webhook secrets if leaked; update RevenueCat and Supabase together.
5. Use Supabase Dashboard Auth settings: email confirmation, leaked-password protection.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial env and secrets documentation |
