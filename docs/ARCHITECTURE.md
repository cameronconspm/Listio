# Listio Architecture

> **Maintenance:** When changing app bootstrap, data flow, sync, or service boundaries, update this document in the same PR.

High-level map of how the Listio mobile app is structured and how it talks to Supabase and external services.

**Related docs:** [TECH_STACK.md](./TECH_STACK.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [FigJam user/backend diagrams](https://www.figma.com/board/OHJCeVba1ELuX8597VxxEy)

---

## System overview

```
┌─────────────────────────────────────────────────────────────┐
│  Listio iOS app (Expo / React Native)                       │
│  Navigation → Screens → Hooks → Services → React Query      │
└───────────────┬─────────────────────────────┬───────────────┘
                │ Supabase client             │ RevenueCat SDK
                ▼                             ▼
┌───────────────────────────┐     ┌─────────────────────────┐
│  Supabase                 │     │  App Store / StoreKit   │
│  Auth · PostgREST ·       │     └───────────┬─────────────┘
│  Realtime · Edge Functions│                 │ webhooks
└───────────────┬───────────┘                 ▼
                │               ┌─────────────────────────────┐
                ▼               │  revenuecat-webhook →       │
┌───────────────────────────┐   │  user_subscription_         │
│  PostgreSQL + RLS         │◄──│  entitlements               │
└───────────────────────────┘   └─────────────────────────────┘
                ▲
                │ OpenAI · Google Places (Edge Functions only)
```

Secrets (OpenAI, Google Places, RevenueCat secret keys) **never** ship in the mobile binary.

---

## App bootstrap pipeline

`src/App.tsx` decides which shell to render. Order matters:

| Stage | Condition | UI shown |
|-------|-----------|----------|
| 1. Config | Missing `EXPO_PUBLIC_SUPABASE_*` | Misconfigured Supabase screen |
| 2. Auth | `isAuthenticated === false` | `AuthNavigator` (sign in / sign up) |
| 3. Password recovery | Recovery deep link consumed | `SetPasswordAfterRecoveryScreen` |
| 4. Onboarding | Not completed (or replay) | `OnboardingFlowScreen` |
| 5. Bootstrap | Auth + onboarding done, home data loading | `BootstrapLoadingScreen` |
| 6. Main app | Bootstrap phase `complete` | `RootNavigator` → tabs |

**Parallel work during bootstrap:**

- **RevenueCat** — identity sync runs in background; does not block the loading screen.
- **Subscription gate (iOS only)** — after onboarding, `fetchPremiumEntitlementActive()` runs; 20s timeout fails **closed** (locked) for App Store review safety.
- **Account bootstrap** — `AccountBootstrapContext` drives progress UI while `fetchHomeListBundle` runs.
- **Deep links** — `listio://` and password-reset URLs handled via `consumeSupabaseAuthFromUrl`.

Provider tree (outer → inner): `ThemeProvider` → `QueryProvider` → `AuthProvider` → `AccountBootstrapProvider` → navigation shells.

---

## Client layers

### Navigation

| Layer | Path | Role |
|-------|------|------|
| Auth stack | `src/navigation/AuthNavigator.tsx` | Welcome, sign in, sign up |
| Root | `src/navigation/RootNavigator.tsx` | Wraps main tabs after bootstrap |
| Tabs | `src/navigation/TabsNavigator.tsx` | List · Meals · Recipes · Profile |
| Feature stacks | `HomeStack`, `MealsStack`, `RecipesStack`, `ProfileStack` | Per-tab push screens |
| Settings | `SettingsStack` | Nested from Profile |

Deep linking config: `src/navigation/linking.ts`.

### State & data fetching

| Layer | Technology | Role |
|-------|------------|------|
| Server state | TanStack React Query | Cached queries, optimistic updates, persistence |
| Query keys | `src/query/keys.ts` | Central invalidation (`homeList`, `meals`, `recipes`, …) |
| Auth | `AuthContext` | Session, `userId`, `isAuthenticated` |
| Premium | `PremiumEntitlementContext` | Client-side entitlement for paywall UX |
| Theme | `ThemeContext` | Scaled design tokens + appearance preference |

Persisted cache: AsyncStorage via `@tanstack/react-query-persist-client` (7-day max age, successful `listio` root queries only).

### Services

`src/services/` is the boundary to Supabase and third parties. Screens and hooks call services; services do not import screens.

| Service area | Key modules |
|--------------|-------------|
| Supabase client | `supabaseClient.ts`, `edgeInvocationAuth.ts` |
| List / shopping | `listService.ts`, `shoppingListService.ts` |
| Meals / recipes | `mealService.ts`, `recipeService.ts` |
| Store | `storeService.ts` |
| AI | `aiService.ts`, `aiCategoryCache.ts` |
| Subscriptions | `purchasesService.ts`, `subscriptionEntitlementSyncService.ts` |
| Notifications | `notificationSchedulingService.ts`, `pushTokenService.ts` |
| Import | `localToCloudImportService.ts` |
| Account | `deleteAccountService.ts`, `userPreferencesService.ts` |

---

## Data flow patterns

### Read path (Home tab example)

1. `BootstrapLoadingScreen` triggers `fetchHomeListBundle(userId)`.
2. Result cached under `queryKeys.homeList(userId)`.
3. `HomeScreen` reads bundle via `useQuery`; list UI derived in memory.
4. Optional: `useListRealtimeSync` invalidates cache when `EXPO_PUBLIC_LIST_REALTIME=1`.

### Write path (add list item)

1. User submits item in UI.
2. **Optional AI:** `categorizeItems()` → Edge Function `categorize-items` → OpenAI (or local cache hit).
3. **Optimistic update:** `useHomeListMutations` patches React Query cache.
4. **Persist:** `listService.insertListItems()` → PostgREST `list_items` insert (RLS).
5. **Side effects:** Realtime invalidation.

### Local → cloud import

When a user signs in and their cloud account is empty, `localToCloudImportService` imports device AsyncStorage data once, then clears local entity storage. Skipped if remote data already exists.

---

## Backend boundary

### What runs on the client

- Supabase Auth session (anon key + user JWT)
- PostgREST reads/writes scoped by RLS
- RevenueCat / StoreKit purchase UI
- Local AI category cache (`aiCategoryCache.ts`)
- Edge Function **invocation** with user JWT in `Authorization` header

### What runs on Edge Functions (Deno)

| Function | Trigger | External deps |
|----------|---------|---------------|
| `categorize-items` | App POST | OpenAI |
| `smart-add` | App POST | OpenAI |
| `parse-recipe` | App POST | OpenAI |
| `place-search` | App POST | Google Geocoding |
| `places-nearby` | App POST | Google Places |
| `place-photo` | App GET | Google Places Photos |
| `sync-subscription-entitlement` | App POST | RevenueCat REST |
| `revenuecat-webhook` | RevenueCat POST | RevenueCat payload |
| `delete-account` | App POST | Supabase Auth admin |

Most functions set `verify_jwt = false` in `supabase/config.toml` due to Kong gateway issues but still validate JWT inside the function via `getUser()`.

See [SUPABASE.md](./SUPABASE.md) (when added) or `README.md` for deploy steps.

---

## Security model (summary)

- **RLS** on all user tables — access via the user's private data scope (`household_id` matched to `auth.uid()`).
- **Service role** — Edge Functions only; used for AI cache writes, webhooks, entitlement mirror.
- **Entitlements table** — clients SELECT own row; writes via webhook / sync function only.
- **Rate limits** — per-user buckets for OpenAI, Places, and parse-recipe (Postgres + Edge logic).

Details: [DATA_MODEL.md](./DATA_MODEL.md).

---

## Feature flags (runtime)

| Flag | Effect |
|------|--------|
| `EXPO_PUBLIC_LIST_REALTIME=1` | Supabase Realtime invalidation on Home list |
| `EXPO_PUBLIC_OFFLINE_MUTATION_QUEUE=1` | Enables offline queue storage (replay TBD) |
| `EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE=1` | Skips IAP gate (internal builds only) |
| `EXPO_PUBLIC_ENABLE_QA_SETTINGS_TOOLS=1` | QA demo tools in Profile |

See also [performance-slos.md](./performance-slos.md).

---

## Key files for onboarding contributors

| Topic | Start here |
|-------|------------|
| App entry | `index.ts` → `src/App.tsx` |
| Auth session | `src/context/AuthContext.tsx`, `src/services/supabaseClient.ts` |
| Home data | `src/query/mealsRangeBundle.ts`, `src/hooks/useHomeListMutations.ts` |
| Premium / paywall | `src/services/purchasesService.ts`, `src/context/ContextualPaywallContext.tsx` |
| Types | `src/types/models.ts` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial architecture documentation |
