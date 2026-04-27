-- Delete a Listio cloud user by email (household cleanup + auth.users).
-- Run in Supabase Dashboard → SQL Editor as a project owner. Uses service DB access.
--
-- Replace the email literal if needed, then run the whole script once.

DO $$
DECLARE
  target_email text := lower(trim('testuser@thelistioapp.com'));
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(trim(email)) = target_email LIMIT 1;

  IF uid IS NULL THEN
    RAISE NOTICE 'No auth.users row for email: %', target_email;
    RETURN;
  END IF;

  RAISE NOTICE 'Deleting user id: %', uid;

  -- Same logic as public.prepare_account_deletion() but for a fixed user id.
  DELETE FROM public.households h
  WHERE h.id IN (
    SELECT x.household_id
    FROM public.household_members x
    WHERE x.household_id IN (SELECT household_id FROM public.household_members WHERE user_id = uid)
    GROUP BY x.household_id
    HAVING COUNT(*) = 1
  );

  DELETE FROM public.household_members hm WHERE hm.user_id = uid;

  DELETE FROM auth.users WHERE id = uid;

  RAISE NOTICE 'Done.';
END $$;
