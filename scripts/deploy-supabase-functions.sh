#!/usr/bin/env bash
# Deploy Listio Edge Functions (including RevenueCat webhook + AI gates).
# Prerequisites: supabase CLI logged in (`supabase login`) and project linked (`supabase link`).
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install: npm i -g supabase (or use npx supabase)" >&2
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-sgeahsvaznfyauikbbsh}"
if ! supabase projects list 2>/dev/null | grep -q "${PROJECT_REF}.*LINKED"; then
  echo "Linking project ${PROJECT_REF} (requires CLI access to this project)..."
  supabase link --project-ref "${PROJECT_REF}" || {
    echo "Could not link. Run: supabase login && supabase link --project-ref ${PROJECT_REF}" >&2
    exit 1
  }
fi

echo "==> Repo checks"
node scripts/verify-revenuecat-webhook.js
node scripts/verify-location-backend.js

echo ""
echo "==> Deploying Edge Functions"
FUNCTIONS=(
  revenuecat-webhook
  sync-subscription-entitlement
  categorize-items
  smart-add
  parse-recipe
  delete-account
  place-search
  places-nearby
  place-photo
)

supabase functions deploy "${FUNCTIONS[@]}" --project-ref "${PROJECT_REF}"

echo ""
echo "==> Required secrets (set if not already):"
echo "  supabase secrets set REVENUECAT_WEBHOOK_SECRET=<random>"
echo "  supabase secrets set REVENUECAT_SECRET_API_KEY=<secret-from-revenuecat-dashboard>"
echo "  supabase secrets set OPENAI_API_KEY=..."
echo "  supabase secrets set GOOGLE_PLACES_API_KEY=..."
echo ""
echo "==> RevenueCat webhook (Dashboard → Integrations → Webhooks):"
echo "  URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook"
echo "  Authorization header: Bearer <REVENUECAT_WEBHOOK_SECRET>"
echo ""
echo "Done."
