#!/usr/bin/env node
/**
 * Pre–App Store / EAS production gate: runs the same checks as CI plus prints a
 * manual TestFlight smoke script. Run before `npm run eas:ios` or `eas:ios:testflight`.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

function run(cmd, args, label) {
  console.log(`\n[verify-pre-release] → ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`[verify-pre-release] FAILED: ${label}`);
    process.exit(r.status ?? 1);
  }
}

function section(title) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

section('Automated checks (same as npm run ci)');
run('npm', ['run', 'typecheck'], 'typecheck');
run('npm', ['run', 'lint'], 'lint');
run('node', ['scripts/verify-location-backend.js'], 'verify:location-backend');
run('node', ['scripts/verify-revenuecat-webhook.js'], 'verify:revenuecat-webhook');
run('node', ['scripts/verify-eas-production-safety.js'], 'verify:eas-production');
run('node', ['scripts/verify-app-store-legal-urls.js'], 'verify:app-store-legal-urls');
run('npm', ['test', '--', '--ci'], 'jest --ci');

section('Release workflow');
console.log(`
Before uploading to App Store Connect, run this script (or npm run ci) on every
production-bound build:

  npm run verify:pre-release
  npm run eas:ios          # or: npm run eas:ios:testflight

EAS production secrets (dashboard — not verifiable from repo):
  - EXPO_PUBLIC_SUPABASE_URL
  - EXPO_PUBLIC_SUPABASE_ANON_KEY
  - EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
  - EXPO_PUBLIC_SENTRY_DSN (optional crash reporting)

Supabase Edge secrets:
  - REVENUECAT_WEBHOOK_SECRET (RevenueCat webhook Authorization bearer)
  - REVENUECAT_SECRET_API_KEY (RevenueCat secret API key — sync-subscription-entitlement + webhook repair)

Use EAS profile "production" or "app-store-review" — NOT "internal-no-iap" or "testflight-qa".
Deploy Edge Functions (including revenuecat-webhook and sync-subscription-entitlement) after merge.
`);

section('TestFlight smoke script (manual — run on device)');
console.log(`
1. Sign in (demo: testuser@thelistioapp.com — password in App Store review credentials)
2. Add list items until the 4th item → contextual paywall → dismiss without subscribing
3. Settings → Restore purchases (sandbox or existing subscriber Apple ID)
4. Smart Add or recipe paste → premium paywall when not subscribed
5. (Staging / QA Supabase only) Settings → Delete account — NEVER on production reviewer account

App Review notes: copy from src/constants/appStoreReviewNotes.ts → APP_STORE_REVIEW_NOTES
`);

console.log('[verify-pre-release] All automated checks passed.\n');
