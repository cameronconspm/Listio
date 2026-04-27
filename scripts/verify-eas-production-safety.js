/**
 * Ensures App Store–bound EAS profiles never set internal-only env flags at build time.
 * Run in CI before release: `node scripts/verify-eas-production-safety.js`
 *
 * Forbidden on production + app-store-review (after resolving `extends`):
 * - EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE — skips IAP gate (internal builds only)
 * - EXPO_PUBLIC_ENABLE_QA_SETTINGS_TOOLS — exposes QA demo tools to any user
 */
const fs = require('fs');
const path = require('path');

const FORBIDDEN = new Set([
  'EXPO_PUBLIC_DISABLE_IOS_SUBSCRIPTION_GATE',
  'EXPO_PUBLIC_ENABLE_QA_SETTINGS_TOOLS',
]);

function readEas() {
  const p = path.join(__dirname, '..', 'eas.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function mergeProfileEnv(cfg, profileName, seen = new Set()) {
  if (seen.has(profileName)) {
    throw new Error(`Circular extends in eas.json involving "${profileName}"`);
  }
  seen.add(profileName);
  const builds = cfg.build ?? {};
  const block = builds[profileName];
  if (!block) {
    throw new Error(`eas.json: missing build profile "${profileName}"`);
  }
  let env = { ...(block.env ?? {}) };
  if (typeof block.extends === 'string') {
    const parent = mergeProfileEnv(cfg, block.extends, seen);
    env = { ...parent, ...env };
  }
  return env;
}

function main() {
  const cfg = readEas();
  const storeProfiles = ['production', 'app-store-review'];

  for (const name of storeProfiles) {
    const env = mergeProfileEnv(cfg, name);
    const bad = [...FORBIDDEN].filter((k) => {
      const v = env[k];
      if (v === undefined || v === null) return false;
      const t = String(v).trim().toLowerCase();
      return t === '1' || t === 'true' || t === 'yes';
    });
    if (bad.length > 0) {
      console.error(
        `[verify-eas-production-safety] Profile "${name}" must not set: ${bad.join(', ')}. ` +
          'Remove these from eas.json env for App Store builds (use testflight-qa / internal-no-iap only).'
      );
      process.exit(1);
    }
  }

  console.log(
    '[verify-eas-production-safety] OK: production and app-store-review do not enable IAP bypass or QA tools env.'
  );
  console.log(
    '[verify-eas-production-safety] Reminder: set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY in EAS Secrets for production — not verifiable from eas.json alone.'
  );
}

main();
