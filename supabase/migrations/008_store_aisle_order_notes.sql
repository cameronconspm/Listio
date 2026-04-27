-- Add aisle_order (supports custom aisles) and notes to store_profiles.
-- aisle_order format: [{"type":"builtin","key":"produce"}, {"type":"custom","id":"uuid","name":"Floral"}, ...]
-- When null, zone_order is used (backward compat). Backfill converts zone_order to aisle_order.

ALTER TABLE public.store_profiles
  ADD COLUMN IF NOT EXISTS aisle_order jsonb,
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill aisle_order from zone_order for existing rows
UPDATE public.store_profiles
SET aisle_order = (
  SELECT jsonb_agg(jsonb_build_object('type', 'builtin', 'key', elem::text))
  FROM jsonb_array_elements_text(zone_order) AS elem
)
WHERE aisle_order IS NULL AND zone_order IS NOT NULL;
