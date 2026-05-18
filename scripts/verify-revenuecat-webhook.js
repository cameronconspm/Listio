#!/usr/bin/env node
/**
 * Repo-side check: revenuecat-webhook edge function exists and reads REVENUECAT_WEBHOOK_SECRET.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'supabase/functions/revenuecat-webhook/index.ts');
const sharedPath = path.join(root, 'supabase/functions/_shared/premiumEntitlement.ts');
const configPath = path.join(root, 'supabase/config.toml');

function check(cond, msg) {
  if (!cond) {
    console.error(`[verify-revenuecat-webhook] ${msg}`);
    process.exit(1);
  }
}

const index = fs.readFileSync(indexPath, 'utf8');
const shared = fs.readFileSync(sharedPath, 'utf8');
const config = fs.readFileSync(configPath, 'utf8');

check(index.includes("Deno.env.get('REVENUECAT_WEBHOOK_SECRET')"), 'webhook must read REVENUECAT_WEBHOOK_SECRET');
check(index.includes('user_subscription_entitlements'), 'webhook must upsert user_subscription_entitlements');
check(shared.includes('fetchUserPremiumActive'), 'shared premiumEntitlement helper required');
check(config.includes('[functions.revenuecat-webhook]'), 'config.toml must declare revenuecat-webhook');

console.log('[verify-revenuecat-webhook] OK');
