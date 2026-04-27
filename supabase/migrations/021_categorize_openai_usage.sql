-- Log each OpenAI API call from categorize-items (service role only) for per-user rate limits.

CREATE TABLE IF NOT EXISTS public.categorize_openai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  called_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorize_openai_usage_user_called
  ON public.categorize_openai_usage (user_id, called_at DESC);

ALTER TABLE public.categorize_openai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categorize_openai_usage_no_client" ON public.categorize_openai_usage;
CREATE POLICY "categorize_openai_usage_no_client" ON public.categorize_openai_usage
  FOR ALL USING (false);
