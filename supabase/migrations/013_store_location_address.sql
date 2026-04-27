-- Optional human-readable address/place label for store location (geocoding / display)

ALTER TABLE public.store_profiles
  ADD COLUMN IF NOT EXISTS location_address text;

COMMENT ON COLUMN public.store_profiles.location_address IS 'Optional label from address search or reverse geocode; not used for distance';
