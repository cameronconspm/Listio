-- Stable map place identity for deduping and map-derived store names

ALTER TABLE public.store_profiles
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS place_provider text
    CHECK (place_provider IS NULL OR place_provider IN ('google'));

COMMENT ON COLUMN public.store_profiles.place_id IS 'Google Places place_id when store is linked to a POI';
COMMENT ON COLUMN public.store_profiles.place_provider IS 'Maps provider for place_id (google)';

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_profiles_household_place_id
  ON public.store_profiles (household_id, place_id)
  WHERE place_id IS NOT NULL;
