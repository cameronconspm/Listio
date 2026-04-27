-- Enforce max 2 members per household (owner + 1 other). Listio allows only one invited member.

CREATE OR REPLACE FUNCTION public.accept_household_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.household_invites%ROWTYPE;
  jwt_email text;
  member_count int;
BEGIN
  jwt_email := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
  IF jwt_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_email_in_jwt');
  END IF;

  SELECT * INTO inv
  FROM public.household_invites
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;

  IF lower(trim(inv.invitee_email)) <> jwt_email THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
  END IF;

  SELECT count(*)::int INTO member_count
  FROM public.household_members
  WHERE household_id = inv.household_id;

  IF member_count >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'household_full');
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (inv.household_id, auth.uid(), 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  UPDATE public.household_invites SET accepted_at = now() WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'household_id', inv.household_id);
END;
$$;
