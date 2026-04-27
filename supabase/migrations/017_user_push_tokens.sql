-- Expo push tokens for remote notifications (household activity, future server nudges)
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_updated_at ON public.user_push_tokens(updated_at);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_push_tokens_select_own" ON public.user_push_tokens;
DROP POLICY IF EXISTS "user_push_tokens_upsert_own" ON public.user_push_tokens;
DROP POLICY IF EXISTS "user_push_tokens_delete_own" ON public.user_push_tokens;

CREATE POLICY "user_push_tokens_select_own" ON public.user_push_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_push_tokens_upsert_own" ON public.user_push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_push_tokens_update_own" ON public.user_push_tokens
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_push_tokens_delete_own" ON public.user_push_tokens
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_push_tokens_updated_at ON public.user_push_tokens;
CREATE TRIGGER user_push_tokens_updated_at
  BEFORE UPDATE ON public.user_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
