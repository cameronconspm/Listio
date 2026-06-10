# Release & Deployment

> **Maintenance:** When changing EAS profiles, verify scripts, App Store steps, or deploy workflows, update this document in the same PR.

How to ship Listio to TestFlight and the App Store, and keep Supabase backend in sync.

**Related docs:** [ENV_AND_SECRETS.md](./ENV_AND_SECRETS.md) · [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) · [TECH_STACK.md](./TECH_STACK.md)

---

## Pre-release checklist

Run before every production-bound iOS build:

```bash
npm run verify:pre-release
```

This runs the same automated checks as CI:

| Step | Command |
|------|---------|
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Location backend | `npm run verify:location-backend` |
| RevenueCat webhook | `npm run verify:revenuecat-webhook` |
| EAS production safety | `npm run verify:eas-production` |
| Legal URLs | `npm run verify:app-store-legal-urls` |
| Tests | `npm test -- --ci` |

Or run everything via:

```bash
npm run ci
```

---

## EAS build profiles

Defined in `eas.json`:

| Profile | When to use |
|---------|-------------|
| **`production`** | App Store and TestFlight builds with IAP |
| **`app-store-review`** | Same as production; extends production |
| **`testflight-qa`** | Internal QA with demo tools enabled |
| **`internal-no-iap`** | Simulator / CI without subscription gate — **not** for review |
| **`development`** | Dev client with native modules |
| **`preview`** | Internal ad-hoc builds |

### Build commands

```bash
# Development client (device / simulator with native modules)
npm run eas:ios:dev

# Production IPA → App Store Connect
npm run eas:ios

# Production + auto-submit to TestFlight
npm run eas:ios:testflight

# Submit latest production build
npm run eas:ios:submit
```

### EAS environment variables (production)

Set in [expo.dev](https://expo.dev) → project → Environment variables → **production**:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` (optional)

Or sync from local `.env`:

```bash
npm run eas:sync-env
```

**Do not** set `EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE` or `EXPO_PUBLIC_ENABLE_QA_SETTINGS_TOOLS` on production profiles.

---

## App Store Connect

### Legal URLs (must load in browser)

Synced with `src/constants/legalUrls.ts`:

| Field | URL |
|-------|-----|
| Privacy Policy | https://thelistioapp.com/privacy-policy |
| Terms / EULA | https://thelistioapp.com/terms-and-conditions |
| Support URL | https://thelistioapp.com/help |

Verified by `npm run verify:app-store-legal-urls`.

### Subscriptions (Guideline 3.1.2)

- **Paid Apps Agreement** must be accepted by Account Holder.
- Products in App Store Connect (e.g. `listio_premium_monthly`, `listio_premium_annual`) mirrored in RevenueCat with entitlement **`premium`**.
- Review steps: Sign in → onboarding → subscription screen → **View plans**, or Profile → Plans & pricing.
- Review notes template: `src/constants/appStoreReviewNotes.ts`

### IAP testing

- **Simulator:** StoreKit Configuration `storekit/Listio.storekit` via Xcode Scheme → Run → Options.
- **Device:** Sandbox Apple ID; Restore Purchases on paywall.

---

## Supabase deployment

### Migrations

Apply all migrations in order (`supabase/migrations/001` … `031`). See [DATA_MODEL.md](./DATA_MODEL.md) for index.

```bash
supabase link --project-ref <your-ref>
supabase db push
```

**Note:** Re-running `002_rls_policies.sql` on an existing project may fail — apply only new migrations.

### Edge Functions

```bash
npm run deploy:supabase-functions
```

Deploys:

`revenuecat-webhook`, `sync-subscription-entitlement`, `categorize-items`, `smart-add`, `parse-recipe`, `delete-account`, `place-search`, `places-nearby`, `place-photo`

Set secrets after deploy (see [ENV_AND_SECRETS.md](./ENV_AND_SECRETS.md)).

### Post-deploy verification

```bash
npm run verify:revenuecat-webhook
npm run verify:location-backend
```

---

## TestFlight smoke test (manual)

From `scripts/verify-pre-release.js`:

1. Sign in (review credentials or test account)
2. Add list items → contextual paywall on limit → dismiss without subscribing
3. Settings → Restore purchases (sandbox)
4. Smart Add or recipe paste → premium paywall when not subscribed
5. **Staging only:** Delete account — never on production reviewer account
6. Home: 50+ items in one zone — scroll smooth
7. Airplane mode on cold Home load — error + retry, not empty list
8. Recipe import — Cancel during parse dismisses overlay
9. Sign out → sign in — cached list restores quickly

---

## Versioning

- App version: `package.json` / `app.json` (`version`)
- iOS build number: EAS `autoIncrement` on production profile (`appVersionSource: remote`)

---

## Rollback

| Layer | Action |
|-------|--------|
| **App Store** | Stop phased release or submit previous build via App Store Connect |
| **EAS** | Re-submit an earlier successful build artifact |
| **Supabase migrations** | Forward-fix only — avoid destructive rollback; write corrective migration |
| **Edge Functions** | Redeploy previous function bundle from git tag |

---

## Release workflow (summary)

```
1. Merge to release branch / main
2. Apply new Supabase migrations (if any)
3. npm run deploy:supabase-functions (if functions changed)
4. npm run verify:pre-release
5. npm run eas:ios:testflight  (or eas:ios for manual submit)
6. TestFlight smoke test
7. Submit for App Store review (app-store-review profile if needed)
8. Monitor Sentry after rollout
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial release documentation |
