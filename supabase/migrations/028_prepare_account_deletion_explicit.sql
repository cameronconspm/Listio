-- Account deletion: deleting a household must run before auth.users removal.
-- If migration 025 (ON DELETE CASCADE on household_id FKs) was never applied,
-- DELETE FROM households alone fails with a foreign key violation.
-- This version removes household-scoped rows in dependency order first.

CREATE OR REPLACE FUNCTION public.prepare_account_deletion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  sole_ids uuid[];
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT COALESCE(array_agg(hid), ARRAY[]::uuid[])
  INTO sole_ids
  FROM (
    SELECT x.household_id AS hid
    FROM public.household_members x
    WHERE x.household_id IN (SELECT household_id FROM public.household_members WHERE user_id = uid)
    GROUP BY x.household_id
    HAVING COUNT(*) = 1
  ) s;

  DELETE FROM public.list_items li WHERE li.household_id = ANY (sole_ids);
  DELETE FROM public.recipes r WHERE r.household_id = ANY (sole_ids);
  DELETE FROM public.meals m WHERE m.household_id = ANY (sole_ids);
  DELETE FROM public.store_profiles sp WHERE sp.household_id = ANY (sole_ids);

  DELETE FROM public.households h WHERE h.id = ANY (sole_ids);

  DELETE FROM public.household_members hm WHERE hm.user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion() TO authenticated;
