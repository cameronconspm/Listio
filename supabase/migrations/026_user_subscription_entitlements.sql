-- Subscription / entitlement state lives in its own table (1:1 with profiles), not on public.profiles.
-- RLS: signed-in users may SELECT their own row only. They cannot INSERT, UPDATE, or DELETE.
-- Writes must use the Supabase service role (e.g. RevenueCat → Edge Function webhook with service key).
-- Client apps should still treat RevenueCat / App Store as the source of truth for paywall UX;
-- this table is for server-side mirrors, analytics, and future RPC checks.

CREATE TABLE IF NOT EXISTS public.user_subscription_entitlements (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  entitlement_id text NOT NULL DEFAULT 'premium',
  is_active boolean NOT NULL DEFAULT false,
  product_identifier text,
  store text CHECK (store IS NULL OR store IN ('app_store', 'play_store', 'stripe', 'promotional', 'unknown')),
  expires_at timestamptz,
  will_renew boolean,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_subscription_entitlements IS
  'Mirror of store entitlements; writable only via service_role (webhooks). Clients: SELECT own row only.';

DROP TRIGGER IF EXISTS user_subscription_entitlements_updated_at ON public.user_subscription_entitlements;
CREATE TRIGGER user_subscription_entitlements_updated_at
  BEFORE UPDATE ON public.user_subscription_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_subscription_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_subscription_entitlements_select_own"
  ON public.user_subscription_entitlements;
CREATE POLICY "user_subscription_entitlements_select_own"
  ON public.user_subscription_entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Intentionally no INSERT / UPDATE / DELETE policies for authenticated or anon.
-- service_role bypasses RLS and is used by trusted backends only.

REVOKE ALL ON public.user_subscription_entitlements FROM PUBLIC;
GRANT SELECT ON public.user_subscription_entitlements TO authenticated;
