-- Per-call-kind OpenAI usage for tiered rate limits (submit vs background vs suggest).

ALTER TABLE public.categorize_openai_usage
  ADD COLUMN IF NOT EXISTS call_kind text NOT NULL DEFAULT 'categorize_submit';

CREATE INDEX IF NOT EXISTS idx_categorize_openai_usage_user_kind_called
  ON public.categorize_openai_usage (user_id, call_kind, called_at DESC);

COMMENT ON COLUMN public.categorize_openai_usage.call_kind IS
  'OpenAI call tier: categorize_submit, categorize_background, suggest, smart_add';
