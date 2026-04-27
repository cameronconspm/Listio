-- Parse-recipe OpenAI usage + cache for cost control and abuse protection.

CREATE TABLE IF NOT EXISTS public.parse_recipe_openai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parse_recipe_openai_usage_user_called
  ON public.parse_recipe_openai_usage (user_id, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_parse_recipe_openai_usage_hash_called
  ON public.parse_recipe_openai_usage (input_hash, called_at DESC);

ALTER TABLE public.parse_recipe_openai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parse_recipe_openai_usage_no_client" ON public.parse_recipe_openai_usage;
CREATE POLICY "parse_recipe_openai_usage_no_client" ON public.parse_recipe_openai_usage
  FOR ALL USING (false);

CREATE TABLE IF NOT EXISTS public.parse_recipe_cache (
  input_hash text PRIMARY KEY,
  recipe_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parse_recipe_cache_updated
  ON public.parse_recipe_cache (updated_at DESC);

ALTER TABLE public.parse_recipe_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parse_recipe_cache_no_client" ON public.parse_recipe_cache;
CREATE POLICY "parse_recipe_cache_no_client" ON public.parse_recipe_cache
  FOR ALL USING (false);
