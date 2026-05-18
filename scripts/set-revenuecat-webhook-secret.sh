#!/usr/bin/env bash
# Set REVENUECAT_WEBHOOK_SECRET on the linked Supabase project (same value as RevenueCat webhook Authorization bearer).
# Usage: REVENUECAT_WEBHOOK_SECRET='your-secret' ./scripts/set-revenuecat-webhook-secret.sh
set -euo pipefail

cd "$(dirname "$0")/.."

SECRET="${REVENUECAT_WEBHOOK_SECRET:-}"
if [[ -z "$SECRET" ]]; then
  echo "Set REVENUECAT_WEBHOOK_SECRET in the environment, e.g.:" >&2
  echo "  REVENUECAT_WEBHOOK_SECRET=\$(openssl rand -hex 32) ./scripts/set-revenuecat-webhook-secret.sh" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found" >&2
  exit 1
fi

supabase secrets set "REVENUECAT_WEBHOOK_SECRET=${SECRET}"
echo "REVENUECAT_WEBHOOK_SECRET set. Configure RevenueCat webhook Authorization: Bearer <same value>"
