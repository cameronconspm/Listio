#!/usr/bin/env node
/**
 * Pushes EXPO_PUBLIC_* from local .env to EAS "production" so TestFlight/store
 * builds embed Supabase config (app.config.js reads these at build time).
 *
 * Usage: node scripts/sync-eas-env-from-dotenv.js
 * Requires: eas-cli auth (`npx eas-cli whoami`), filled .env
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

function loadEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (out[key] === undefined) out[key] = val;
  }
  return out;
}

function easEnvCreate(name, value, visibility) {
  const r = spawnSync(
    'npx',
    [
      'eas-cli@latest',
      'env:create',
      'production',
      '--name',
      name,
      '--value',
      value,
      '--visibility',
      visibility,
      '--type',
      'string',
      '--environment',
      'production',
      '--non-interactive',
      '--force',
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, CI: '1' },
    }
  );
  return r.status === 0;
}

const env = loadEnvFile(envPath);
const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

if (!url || !url.startsWith('http')) {
  console.error(
    'sync-eas-env-from-dotenv: EXPO_PUBLIC_SUPABASE_URL missing or invalid in .env'
  );
  process.exit(1);
}
if (!anon) {
  console.error('sync-eas-env-from-dotenv: EXPO_PUBLIC_SUPABASE_ANON_KEY missing in .env');
  process.exit(1);
}

const who = spawnSync('npx', ['eas-cli@latest', 'whoami'], { cwd: root, encoding: 'utf8' });
if (who.status !== 0 || !String(who.stdout || '').trim()) {
  console.error('sync-eas-env-from-dotenv: run `npx eas-cli login` first.');
  process.exit(1);
}

console.log('sync-eas-env-from-dotenv: pushing EXPO_PUBLIC_SUPABASE_URL (plaintext) …');
if (!easEnvCreate('EXPO_PUBLIC_SUPABASE_URL', url, 'plaintext')) process.exit(1);

console.log('sync-eas-env-from-dotenv: pushing EXPO_PUBLIC_SUPABASE_ANON_KEY (sensitive) …');
if (!easEnvCreate('EXPO_PUBLIC_SUPABASE_ANON_KEY', anon, 'sensitive')) process.exit(1);

const androidKey = env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY?.trim();
if (androidKey) {
  console.log(
    'sync-eas-env-from-dotenv: pushing EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY (sensitive) …'
  );
  if (!easEnvCreate('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY', androidKey, 'sensitive'))
    process.exit(1);
}

const revenueCatIos = env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
if (revenueCatIos) {
  console.log(
    'sync-eas-env-from-dotenv: pushing EXPO_PUBLIC_REVENUECAT_IOS_API_KEY (sensitive) …'
  );
  if (!easEnvCreate('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY', revenueCatIos, 'sensitive'))
    process.exit(1);
}

const passwordResetWeb = env.EXPO_PUBLIC_PASSWORD_RESET_WEB_URL?.trim();
if (passwordResetWeb) {
  console.log(
    'sync-eas-env-from-dotenv: pushing EXPO_PUBLIC_PASSWORD_RESET_WEB_URL (plaintext) …'
  );
  if (!easEnvCreate('EXPO_PUBLIC_PASSWORD_RESET_WEB_URL', passwordResetWeb, 'plaintext'))
    process.exit(1);
}

console.log('sync-eas-env-from-dotenv: done. Verify with: npx eas-cli env:list --environment production');
