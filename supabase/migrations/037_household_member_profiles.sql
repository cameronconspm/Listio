-- Expose household co-member display names for Share list UI (profile name, else email).

CREATE OR REPLACE FUNCTION public.fetch_household_member_profiles(p_household_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  full_name text,
  email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT
    hm.user_id,
    hm.role,
    nullif(trim(u.raw_user_meta_data->>'full_name'), '') AS full_name,
    nullif(trim(u.email), '') AS email
  FROM public.household_members hm
  INNER JOIN auth.users u ON u.id = hm.user_id
  WHERE hm.household_id = p_household_id
    AND public.is_household_member(p_household_id)
  ORDER BY hm.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.fetch_household_member_profiles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_household_member_profiles(uuid) TO authenticated;
