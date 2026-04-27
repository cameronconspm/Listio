-- Per-account settings (appearance, units, shopping mode, meal schedule, notification toggles)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON public.user_preferences(updated_at);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;

CREATE POLICY "user_preferences_select_own" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ai_item_cache: authenticated users may read only; writes go through Edge Function + service role
DROP POLICY IF EXISTS "ai_item_cache_insert" ON public.ai_item_cache;
DROP POLICY IF EXISTS "ai_item_cache_update" ON public.ai_item_cache;
DROP POLICY IF EXISTS "ai_item_cache_select" ON public.ai_item_cache;
DROP POLICY IF EXISTS "ai_item_cache_select_authenticated" ON public.ai_item_cache;

CREATE POLICY "ai_item_cache_select_authenticated" ON public.ai_item_cache
  FOR SELECT TO authenticated USING (true);
