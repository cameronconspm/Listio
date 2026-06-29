-- Allow household owners to revoke pending invites.

DROP POLICY IF EXISTS "household_invites_delete_owner" ON public.household_invites;
CREATE POLICY "household_invites_delete_owner" ON public.household_invites
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_invites.household_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'owner'
    )
  );
