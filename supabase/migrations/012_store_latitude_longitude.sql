-- Optional geocoordinates for each saved store (nearest-store suggestions on List tab)

ALTER TABLE public.store_profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

COMMENT ON COLUMN public.store_profiles.latitude IS 'Optional WGS84 latitude set from device when user saves store location';
COMMENT ON COLUMN public.store_profiles.longitude IS 'Optional WGS84 longitude set from device when user saves store location';
