# Listio Tech Stack

> **Maintenance:** When adding or changing stack-related technology (dependencies, backend services, build tooling, env vars, etc.), update this document in the same PR.

Listio is an iOS-first grocery list app with meal planning, recipes, store-zone grouping, and AI-assisted item categorization.

## Product overview

- **List** — Add items (paste or type); AI categorizes by store zone; check off while shopping
- **Meals** — Plan meals; push missing ingredients to the list
- **Recipes** — Save recipes; add to meals or list
- **Settings / account** — Store type, zone order, preferences, subscriptions, notifications

---

## Architecture (high level)

```
React Native (Expo) app
  → TanStack Query + Supabase client (Auth, Postgres, Realtime)
  → Supabase Edge Functions → OpenAI, Google Places, RevenueCat webhooks
  → RevenueCat + StoreKit for iOS subscriptions
  → Expo Notifications + Sentry for push and monitoring
  → EAS for builds and App Store delivery
```

The shipped app path is **cloud-backed**: users sign in with Supabase; data lives in Postgres with RLS; AI and location-sensitive work runs on Edge Functions so secrets never ship in the client.

---

## Mobile app (client)

| Technology | Purpose |
|------------|---------|
| **Expo (~54) + React Native (0.81)** | Cross-platform mobile framework; primary target is iOS via dev builds and EAS |
| **React 19 + TypeScript** | UI layer and type-safe application code |
| **Expo Dev Client** | Native modules (maps, keyboard composer, IAP) that Expo Go cannot load |
| **React Navigation** (native stack + bottom tabs) | Screen routing, auth vs main app, deep links (`listio://`) |
| **TanStack React Query** | Server state caching, refetch on foreground, optimistic updates |
| **AsyncStorage + query persister** | Persists last-known query data for fast cold starts |
| **Supabase JS client** | Auth, Postgres reads/writes, Realtime subscriptions, Edge Function calls |
| **AsyncStorage / Secure Store** | Session persistence, secure tokens; legacy/local fallbacks in tests |
| **`listio-keyboard-composer`** (custom Expo module) | Native iOS keyboard/composer UX for quick-add input |
| **react-native-keyboard-controller** | Keyboard-aware layouts and animations |
| **react-native-reanimated + gesture-handler + worklets** | Animations, swipe gestures, drag-and-drop |
| **react-native-draggable-flatlist** | Reorderable list rows (e.g. store zones) |
| **react-native-safe-area-context** | Safe area insets |
| **react-native-svg** | Vector graphics |
| **react-native-toast-message** | In-app feedback toasts |
| **@react-native-menu/menu** | Native iOS context menus |
| **Expo UI modules** | Blur, haptics, gradients, fonts, splash, status bar, store review, localization, etc. |
| **Design system** (`src/design/`) | Tokens, typography, spacing; Apple-like “Liquid Glass” visual style |

---

## Backend & data

| Technology | Purpose |
|------------|---------|
| **Supabase Auth** | Sign up, sign in, sessions, password recovery |
| **Supabase Postgres** | Primary data: lists, items, meals, recipes, stores, preferences |
| **Row Level Security (RLS)** | Per-user data isolation (each user has a private data namespace) |
| **Supabase Realtime** | Live sync of list changes |
| **Supabase Edge Functions (Deno)** | Server-side logic that must not run on the client |
| **SQL migrations** (`supabase/migrations/`) | Versioned schema changes |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `categorize-items` | OpenAI item → store zone classification; shared AI cache |
| `smart-add` | AI-assisted item parsing/adding |
| `parse-recipe` | Recipe text/URL parsing via OpenAI; rate-limited and cached |
| `place-search` | Google Geocoding for store address lookup |
| `places-nearby` | Google Places Nearby Search |
| `place-photo` | Proxied place photos (rate-limited) |
| `revenuecat-webhook` | RevenueCat subscription events |
| `sync-subscription-entitlement` | Mirrors premium status into Postgres |
| `delete-account` | Account deletion orchestration |

### External APIs (server-side)

| Service | Purpose |
|---------|---------|
| **OpenAI** | Item categorization, recipe parsing, smart add |
| **Google Places / Geocoding** | Store location search and nearby stores |
| **Google Maps SDK** (Android client key) | In-app maps on Android; iOS uses Apple MapKit |

---

## Monetization

| Technology | Purpose |
|------------|---------|
| **RevenueCat** (`react-native-purchases`, `react-native-purchases-ui`) | iOS subscriptions, paywalls, restore purchases, entitlements |
| **StoreKit** (`storekit/Listio.storekit`, custom Expo plugin) | Local StoreKit testing and IAP configuration |
| **Supabase entitlement mirror** | Server-side premium status for RLS and backend checks |
| **EAS build profiles** | `production`, `app-store-review`, `testflight-qa`, `internal-no-iap` |

---

## Notifications & engagement

| Technology | Purpose |
|------------|---------|
| **expo-notifications** | Local reminders and remote push |
| **Expo push tokens in Postgres** | Device token storage per user |
| **expo-store-review** | App Store rating prompts |

---

## Observability

| Technology | Purpose |
|------------|---------|
| **Sentry** (`@sentry/react-native`) | Crash reporting and performance tracing |
| **Custom perf utilities** (`src/utils/perf.ts`) | Launch and cold-start timing |

---

## Build, deploy & quality

| Technology | Purpose |
|------------|---------|
| **EAS** | iOS builds, TestFlight, App Store submit, env injection |
| **Supabase CLI** | Migrations, function deploy, secrets |
| **Jest + jest-expo + ts-jest** | Unit/integration tests (`__tests__/`) |
| **ESLint + Prettier** | Linting and formatting |
| **TypeScript** | Static type checking (`npm run typecheck`) |
| **patch-package** | Third-party dependency patches |
| **`npm run ci`** | Typecheck, lint, verification scripts, tests |

---

## Key environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | App `.env` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | App `.env` | Supabase anon key |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | App `.env` / EAS | RevenueCat iOS SDK key |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` | App `.env` | Android Maps SDK (prebuild) |
| `EXPO_PUBLIC_SENTRY_DSN` | App `.env` | Sentry (optional) |
| `OPENAI_API_KEY` | Supabase secrets | Edge Functions → OpenAI |
| `GOOGLE_PLACES_API_KEY` | Supabase secrets | Place search / nearby |
| `SUPABASE_SERVICE_ROLE_KEY` | Hosted Edge Functions (auto) | Service-role DB access in functions |

See `README.md` for full setup and migration order. See [DATA_MODEL.md](./DATA_MODEL.md) for the migration index.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial tech stack documentation |
