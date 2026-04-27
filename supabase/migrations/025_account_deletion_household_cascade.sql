-- Account deletion: deleting a household must remove shared list/meals/recipes/stores for that home.
-- prepare_account_deletion() deletes sole-member households; CASCADE clears dependent rows.

ALTER TABLE public.list_items
  DROP CONSTRAINT IF EXISTS list_items_household_id_fkey;
ALTER TABLE public.list_items
  ADD CONSTRAINT list_items_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_household_id_fkey;
ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.meals
  DROP CONSTRAINT IF EXISTS meals_household_id_fkey;
ALTER TABLE public.meals
  ADD CONSTRAINT meals_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.store_profiles
  DROP CONSTRAINT IF EXISTS store_profiles_household_id_fkey;
ALTER TABLE public.store_profiles
  ADD CONSTRAINT store_profiles_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

-- Run before auth user removal: sole-member homes (and their data) go away; shared homes lose this member only.
CREATE OR REPLACE FUNCTION public.prepare_account_deletion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  DELETE FROM public.households h
  WHERE h.id IN (
    SELECT x.household_id
    FROM public.household_members x
    WHERE x.household_id IN (SELECT household_id FROM public.household_members WHERE user_id = uid)
    GROUP BY x.household_id
    HAVING COUNT(*) = 1
  );

  DELETE FROM public.household_members hm
  WHERE hm.user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion() TO authenticated;
