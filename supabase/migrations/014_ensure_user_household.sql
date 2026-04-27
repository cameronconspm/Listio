-- Repair path: users with a profile but no household_members row (e.g. trigger missed, pre-migration account).
-- Also used by the app when onboarding updates household name before membership exists.

CREATE OR REPLACE FUNCTION public.ensure_user_household()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  hid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT hm.household_id INTO hid
  FROM public.household_members hm
  WHERE hm.user_id = uid
  ORDER BY hm.created_at ASC
  LIMIT 1;

  IF hid IS NOT NULL THEN
    RETURN hid;
  END IF;

  INSERT INTO public.profiles (id)
  VALUES (uid)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.households (name)
  VALUES ('Home')
  RETURNING id INTO hid;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (hid, uid, 'owner');

  RETURN hid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_household() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_household() TO authenticated;
