-- One-time: remove internal QA auth user testuser@thelistioapp.com (household cleanup + auth.users).
-- Idempotent: no-op with NOTICE if the user does not exist.

DO $$
DECLARE
  target_email text := lower(trim('testuser@thelistioapp.com'));
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(trim(email)) = target_email LIMIT 1;

  IF uid IS NULL THEN
    RAISE NOTICE '027_remove_listio_qa_test_user: no auth.users row for %', target_email;
    RETURN;
  END IF;

  RAISE NOTICE '027_remove_listio_qa_test_user: deleting user %', uid;

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

  RAISE NOTICE '027_remove_listio_qa_test_user: done';
END $$;
