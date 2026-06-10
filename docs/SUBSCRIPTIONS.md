# Subscriptions & Monetization

> **Maintenance:** When changing RevenueCat products, entitlement logic, free-tier caps, or paywall triggers, update this document in the same PR.

How Listio handles iOS subscriptions, free-tier limits, server-side entitlement mirroring, and contextual paywalls.

**Related docs:** [ENV_AND_SECRETS.md](./ENV_AND_SECRETS.md) · [RELEASE.md](./RELEASE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Product model

**Listio+** (premium) unlocks:

- Unlimited list items, meals, and recipes (free tier has caps)
- AI features: Smart Add, recipe URL import, recipe paste parsing
- Engagement / milestone upsells tied to habit formation

Free tier is intentionally usable for a real grocery week; upsell is at AI and scale limits, not basic list use.

---

## RevenueCat setup

| Setting | Value |
|---------|-------|
| Entitlement ID | `premium` (`src/constants/subscription.ts`) |
| iOS products (example) | `listio_premium_monthly` (~$2.99/mo), `listio_premium_annual` (~$30/yr) |
| Public SDK key | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` |
| UI | `react-native-purchases` + `react-native-purchases-ui` |

### Platform enforcement

- **iOS:** Subscription gate enforced when RevenueCat is configured (`subscriptionPlatformEnforced()`).
- **Android:** Gate passes through until Play Billing is added.

### Disable gate (internal only)

Build-time flag `EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE=1` (EAS profile `internal-no-iap`). Skips RevenueCat init and paywalls. **Never** ship to App Store review.

---

## Client entitlement flow

```
App launch (iOS)
  → ensurePurchasesConfigured()
  → syncPurchasesIdentity(userId)     // background, non-blocking
  → fetchPremiumEntitlementActive()   // after onboarding; 20s timeout → locked
  → PremiumEntitlementProvider        // isPremium for UI
  → ContextualPaywallProvider         // feature-level upsells
```

**Source of truth for paywall UX:** RevenueCat `CustomerInfo` (entitlement `premium` active).

**Fail-closed:** If entitlement check times out after 20s, user sees locked state; **Restore Purchases** on paywall can recover.

Listeners: `installRevenueCatCustomerInfoListener()` + `subscribePremiumStatusChanges()`.

Key module: `src/services/purchasesService.ts`.

---

## Server entitlement mirror

Table: `user_subscription_entitlements` (migration `026`).

| Column | Purpose |
|--------|---------|
| `user_id` | PK → profiles |
| `entitlement_id` | `premium` |
| `is_active` | Server mirror flag |
| `product_identifier`, `store`, `expires_at`, `will_renew` | From RevenueCat |

**Clients:** SELECT own row only. **Writes:** service role via Edge Functions only.

### Why mirror?

Edge Functions (`categorize-items`, `smart-add`, `parse-recipe`) gate premium AI using server state, not client-reported status.

### Sync paths

| Path | Trigger |
|------|---------|
| **Webhook (primary)** | RevenueCat → `revenuecat-webhook` Edge Function |
| **Client repair** | After purchase/login → `sync-subscription-entitlement` |
| **Background warm** | `ensureServerSubscriptionMirror()` after premium confirmed |

Webhook config:

- URL: `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`
- Authorization: `Bearer <REVENUECAT_WEBHOOK_SECRET>`

Client invokes `sync-subscription-entitlement` with user JWT. Server uses `REVENUECAT_SECRET_API_KEY` to read RevenueCat REST API.

Modules: `src/services/subscriptionEntitlementSyncService.ts`, `supabase/functions/revenuecat-webhook/`, `supabase/functions/sync-subscription-entitlement/`.

Shared parsing: `shared/premiumEntitlementCore.ts`.

---

## Free tier caps

Defined in `src/constants/freeTierCaps.ts`:

| Resource | Free limit |
|----------|------------|
| List items | **50** |
| Meals | **7** |
| Recipes | **10** |

Enforced in `src/services/freeTierLimits.ts` via `ensureFreeTierCapacity()` before inserts.

Exceeding a cap opens a **contextual paywall** (user can dismiss and stay on free plan).

---

## Contextual paywall reasons

| Reason | Trigger |
|--------|---------|
| `list_limit` | Adding items beyond 50 |
| `meal_limit` | Adding meals beyond 7 |
| `recipe_limit` | Saving recipes beyond 10 |
| `smart_add` | Multi-item AI add (premium feature) |
| `recipe_url` | Import recipe from URL |
| `recipe_paste` | Paste recipe text for parsing |
| `engagement` | Habit-based upsell |
| `milestone_unlock` | First-launch tour milestone |

Copy: `src/context/contextualPaywallReasons.ts`.

Provider: `ContextualPaywallContext` wraps main app in `App.tsx`.

---

## StoreKit local testing

| Tool | Path |
|------|------|
| StoreKit config file | `storekit/Listio.storekit` |
| Expo plugin | `plugins/withListioStorekit.js` |
| Xcode | Scheme → Run → Options → StoreKit Configuration |

Attach `Listio.storekit` for simulator IAP without App Store Connect.

---

## EAS profiles vs subscriptions

| Profile | IAP behavior |
|---------|--------------|
| `production`, `app-store-review` | Full gate + RevenueCat |
| `testflight-qa` | Full gate + QA demo tools in Profile |
| `internal-no-iap` | Gate disabled — internal/simulator only |

---

## App Store review

Reviewers must see:

1. Sign in / create account
2. Onboarding
3. Subscription / **View plans** screen (monthly + annual)
4. Restore Purchases

Do **not** submit `internal-no-iap` or enable `EXPO_PUBLIC_ENABLE_QA_SETTINGS_TOOLS` for production App Store builds.

Review notes: `src/constants/appStoreReviewNotes.ts`.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Stuck on subscription gate | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` on EAS; products in RC + ASC |
| AI works but paywall shows | Client premium OK; run sync — check `user_subscription_entitlements` row |
| Restore doesn't unlock | Sandbox Apple ID; RevenueCat customer linked to Supabase user id |
| Simulator no products | StoreKit file attached in Xcode scheme |
| Webhook not updating DB | `REVENUECAT_WEBHOOK_SECRET` matches RC Authorization header |

Verify webhook repo config: `npm run verify:revenuecat-webhook`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial subscriptions documentation |
