-- Smoke test: legacy App Store insert path (household_id only, no list_id).
-- Runs as authenticated test user via JWT claim simulation; cleans up after.

BEGIN;

SELECT set_config('request.jwt.claim.sub', '1518a23f-2834-4507-9ea9-562ab83ef15e', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL role authenticated;

WITH inserted AS (
  INSERT INTO public.list_items (
    user_id,
    household_id,
    name,
    normalized_name,
    category,
    zone_key,
    quantity_value,
    quantity_unit,
    notes,
    is_checked,
    linked_meal_ids
  ) VALUES (
    '1518a23f-2834-4507-9ea9-562ab83ef15e',
    '3bb1c45a-8bf1-4c36-895c-e0cd45b9ea9b',
    '__smoke_test_legacy_insert__',
    'smoke test legacy insert',
    'Produce',
    'produce',
    NULL,
    NULL,
    NULL,
    false,
    '{}'::uuid[]
  )
  RETURNING id, list_id, household_id, name
)
SELECT
  i.id IS NOT NULL AS insert_ok,
  i.list_id IS NOT NULL AS list_id_backfilled,
  EXISTS (
    SELECT 1
    FROM public.shopping_lists sl
    WHERE sl.id = i.list_id
      AND sl.household_id = i.household_id
  ) AS list_id_matches_household,
  i.id AS inserted_id
FROM inserted i;

-- Cleanup smoke row
DELETE FROM public.list_items
WHERE name = '__smoke_test_legacy_insert__'
  AND user_id = '1518a23f-2834-4507-9ea9-562ab83ef15e';

COMMIT;
