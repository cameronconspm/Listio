# Pre-release soak test checklist

Run on a **physical iPhone** before App Store submission. Check each path; note failures in TestFlight feedback.

**Last automated run:** 2026-06-29 (commit `b3e8d1b`, parse-recipe v10 deployed)

## Automated verification (2026-06-29)

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm test -- --ci` | Pass (266 tests) |
| `npm run verify:location-backend` | Pass |
| `npm run verify:revenuecat-webhook` | Pass |
| `supabase functions deploy parse-recipe` | Deployed v10 |
| `supabase migration list` | 001–034 local = remote |
| `npm run ci` | **Fail** — 25 ESLint warnings (no errors); fix before `verify:pre-release` |
| `scripts/smoke-test-legacy-list-insert-api.js` | Not run (requires `.env` + `LISTIO_SMOKE_TEST_PASSWORD`) |

**Unit-test coverage for release features:** `appDeepLinkService`, `shoppingListService`, `useShoppingMode`, `themePreferenceService`, `funnelAnalyticsService`, `normalizeRecipeImportUrl`, `edgeInvocationAuth`.

---

## Critical paths

- [ ] Cold start → Welcome intro → Sign up → Onboarding (all 4 steps) → Bootstrap → List tab
- [ ] Add item by typing → auto-categorized into zone
- [ ] Switch to Shop mode → check items off → complete shop run → mascot celebration
- [ ] Sign out → Sign in with existing account → data persists
- [ ] Forgot password email → deep link `listio://auth/reset-password` → set new password
- [ ] Profile → Plan → contextual paywall at free limit
- [ ] Restore purchases (Settings → Restore purchases)
- [ ] Profile → Share list → send invite → accept on second account
- [ ] Home screen widget shows unchecked count (dev/EAS build with native widget module)
- [ ] Sign in with Apple (iOS device; **Supabase Auth → Apple provider must be enabled**)
- [ ] Multi-list: create second list → switch active list → items isolated per list
- [ ] Siri Shortcut: "Add milk to Listio" via `listio://add?item=milk`

## Network & lifecycle

- [ ] Background app during shop trip → foreground → list state intact
- [ ] Airplane mode off → add item on flaky Wi‑Fi → sync when back online
- [ ] Kill app mid-shop → relaunch → checked state preserved

## Appearance & accessibility

- [ ] Light mode all main tabs
- [ ] Dark mode all main tabs
- [ ] Reduce Motion enabled → animations respect setting
- [ ] VoiceOver on List item row and Shop mode check

---

## Manual commands

```bash
# Full automated gate (after ESLint warnings fixed)
npm run verify:pre-release

# Legacy list insert (migration 033 trigger) — needs .env
set -a && source .env && set +a
node scripts/smoke-test-legacy-list-insert-api.js

# Recipe URL import smoke — in app: Recipes → import URL (uses parse-recipe v6 cache)
```
