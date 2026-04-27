-- Rate limiting for household push notifications (Edge Function inserts via service role)
CREATE TABLE IF NOT EXISTS public.household_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_household_push_log_household_sent
  ON public.household_push_log (household_id, sent_at DESC);

ALTER TABLE public.household_push_log ENABLE ROW LEVEL SECURITY;

-- No client access; service role bypasses RLS for Edge Functions
DROP POLICY IF EXISTS "household_push_log_no_client" ON public.household_push_log;
CREATE POLICY "household_push_log_no_client" ON public.household_push_log
  FOR ALL USING (false);
