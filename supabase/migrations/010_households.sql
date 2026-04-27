-- Households: shared scope for list, meals, recipes, stores

CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Home',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON public.household_members(household_id);

CREATE TABLE IF NOT EXISTS public.household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_invites_token ON public.household_invites(token);
CREATE INDEX IF NOT EXISTS idx_household_invites_household ON public.household_invites(household_id);

-- Backfill: every profile gets a household + owner membership
DO $$
DECLARE
  r RECORD;
  hid uuid;
BEGIN
  FOR r IN SELECT p.id FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.user_id = p.id)
  LOOP
    INSERT INTO public.households (name) VALUES ('Home') RETURNING id INTO hid;
    INSERT INTO public.household_members (household_id, user_id, role) VALUES (hid, r.id, 'owner');
  END LOOP;
END $$;

-- New signups: profile + default household
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_hh uuid;
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.household_members WHERE user_id = NEW.id) THEN
    INSERT INTO public.households (name) VALUES ('Home') RETURNING id INTO new_hh;
    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (new_hh, NEW.id, 'owner');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS: households
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "households_select_member" ON public.households;
CREATE POLICY "households_select_member" ON public.households
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = households.id AND hm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "households_update_owner" ON public.households;
CREATE POLICY "households_update_owner" ON public.households
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = households.id AND hm.user_id = auth.uid() AND hm.role = 'owner'
    )
  );

-- RLS: household_members
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_members_select" ON public.household_members;
CREATE POLICY "household_members_select" ON public.household_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_members.household_id AND hm.user_id = auth.uid()
    )
  );

-- New members join via accept_household_invite (SECURITY DEFINER); no direct INSERT for authenticated.

DROP POLICY IF EXISTS "household_members_delete_owner" ON public.household_members;
CREATE POLICY "household_members_delete_owner" ON public.household_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_members.household_id AND hm.user_id = auth.uid() AND hm.role = 'owner'
    )
    AND household_members.user_id <> auth.uid()
  );

-- RLS: household_invites
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_invites_select" ON public.household_invites;
CREATE POLICY "household_invites_select" ON public.household_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_invites.household_id AND hm.user_id = auth.uid()
    )
    OR lower(trim(invitee_email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
  );

DROP POLICY IF EXISTS "household_invites_insert_owner" ON public.household_invites;
CREATE POLICY "household_invites_insert_owner" ON public.household_invites
  FOR INSERT WITH CHECK (
    inviter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_invites.household_id AND hm.user_id = auth.uid() AND hm.role = 'owner'
    )
  );

DROP POLICY IF EXISTS "household_invites_update_owner" ON public.household_invites;
CREATE POLICY "household_invites_update_owner" ON public.household_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_invites.household_id AND hm.user_id = auth.uid() AND hm.role = 'owner'
    )
  );

-- Invitee accepts via RPC (bypasses RLS on household_members)
CREATE OR REPLACE FUNCTION public.accept_household_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.household_invites%ROWTYPE;
  jwt_email text;
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

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (inv.household_id, auth.uid(), 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  UPDATE public.household_invites SET accepted_at = now() WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'household_id', inv.household_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_household_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_household_invite(text) TO authenticated;
