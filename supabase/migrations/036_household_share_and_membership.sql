-- Household share toggles (stored in metadata), leave/remove membership RPCs.

CREATE OR REPLACE FUNCTION public.leave_household(p_household_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  member_role text;
  personal_hid uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT role INTO member_role
  FROM public.household_members
  WHERE household_id = p_household_id AND user_id = uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
  END IF;

  IF member_role = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'owner_cannot_leave');
  END IF;

  DELETE FROM public.household_members
  WHERE household_id = p_household_id AND user_id = uid;

  SELECT hm.household_id INTO personal_hid
  FROM public.household_members hm
  WHERE hm.user_id = uid AND hm.role = 'owner'
  ORDER BY hm.created_at ASC
  LIMIT 1;

  IF personal_hid IS NULL THEN
    personal_hid := public.ensure_user_household();
  END IF;

  RETURN jsonb_build_object('ok', true, 'personal_household_id', personal_hid);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_household_member(p_household_id uuid, p_member_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  target_role text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_member_user_id = uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_remove_self');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = p_household_id AND hm.user_id = uid AND hm.role = 'owner'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  SELECT role INTO target_role
  FROM public.household_members
  WHERE household_id = p_household_id AND user_id = p_member_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member_not_found');
  END IF;

  IF target_role = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_remove_owner');
  END IF;

  DELETE FROM public.household_members
  WHERE household_id = p_household_id AND user_id = p_member_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_household(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_household(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_household_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_household_member(uuid, uuid) TO authenticated;

-- Service-role lookup for invite push delivery.
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT id FROM auth.users
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO service_role;
