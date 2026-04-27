-- RLS on household_members used EXISTS (SELECT ... FROM household_members ...), which
-- re-evaluates policies on the same table and causes: infinite recursion detected in policy.
-- Helpers run as SECURITY DEFINER so the membership read bypasses RLS (see Postgres docs).

CREATE OR REPLACE FUNCTION public.is_household_member(_household_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_owner(_household_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_household_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_household_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO service_role;

-- households
DROP POLICY IF EXISTS "households_select_member" ON public.households;
CREATE POLICY "households_select_member" ON public.households
  FOR SELECT USING (public.is_household_member(id));

DROP POLICY IF EXISTS "households_update_owner" ON public.households;
CREATE POLICY "households_update_owner" ON public.households
  FOR UPDATE USING (public.is_household_owner(id));

-- household_members (no self-referential subquery)
DROP POLICY IF EXISTS "household_members_select" ON public.household_members;
CREATE POLICY "household_members_select" ON public.household_members
  FOR SELECT USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "household_members_delete_owner" ON public.household_members;
CREATE POLICY "household_members_delete_owner" ON public.household_members
  FOR DELETE USING (
    public.is_household_owner(household_id)
    AND household_members.user_id <> auth.uid()
  );

-- household_invites
DROP POLICY IF EXISTS "household_invites_select" ON public.household_invites;
CREATE POLICY "household_invites_select" ON public.household_invites
  FOR SELECT USING (
    public.is_household_member(household_id)
    OR lower(trim(invitee_email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
  );

DROP POLICY IF EXISTS "household_invites_insert_owner" ON public.household_invites;
CREATE POLICY "household_invites_insert_owner" ON public.household_invites
  FOR INSERT WITH CHECK (
    inviter_id = auth.uid()
    AND public.is_household_owner(household_id)
  );

DROP POLICY IF EXISTS "household_invites_update_owner" ON public.household_invites;
CREATE POLICY "household_invites_update_owner" ON public.household_invites
  FOR UPDATE USING (public.is_household_owner(household_id));

-- Scoped tables (011): replace subqueries on household_members
DROP POLICY IF EXISTS "store_profiles_select_hh" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_insert_hh" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_update_hh" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_delete_hh" ON public.store_profiles;

CREATE POLICY "store_profiles_select_hh" ON public.store_profiles FOR SELECT USING (
  public.is_household_member(household_id)
);
CREATE POLICY "store_profiles_insert_hh" ON public.store_profiles FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND public.is_household_member(household_id)
);
CREATE POLICY "store_profiles_update_hh" ON public.store_profiles FOR UPDATE USING (
  public.is_household_member(household_id)
);
CREATE POLICY "store_profiles_delete_hh" ON public.store_profiles FOR DELETE USING (
  public.is_household_member(household_id)
);

DROP POLICY IF EXISTS "list_items_select_hh" ON public.list_items;
DROP POLICY IF EXISTS "list_items_insert_hh" ON public.list_items;
DROP POLICY IF EXISTS "list_items_update_hh" ON public.list_items;
DROP POLICY IF EXISTS "list_items_delete_hh" ON public.list_items;

CREATE POLICY "list_items_select_hh" ON public.list_items FOR SELECT USING (
  public.is_household_member(household_id)
);
CREATE POLICY "list_items_insert_hh" ON public.list_items FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND public.is_household_member(household_id)
);
CREATE POLICY "list_items_update_hh" ON public.list_items FOR UPDATE USING (
  public.is_household_member(household_id)
);
CREATE POLICY "list_items_delete_hh" ON public.list_items FOR DELETE USING (
  public.is_household_member(household_id)
);

DROP POLICY IF EXISTS "recipes_select_hh" ON public.recipes;
DROP POLICY IF EXISTS "recipes_insert_hh" ON public.recipes;
DROP POLICY IF EXISTS "recipes_update_hh" ON public.recipes;
DROP POLICY IF EXISTS "recipes_delete_hh" ON public.recipes;

CREATE POLICY "recipes_select_hh" ON public.recipes FOR SELECT USING (
  public.is_household_member(household_id)
);
CREATE POLICY "recipes_insert_hh" ON public.recipes FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND public.is_household_member(household_id)
);
CREATE POLICY "recipes_update_hh" ON public.recipes FOR UPDATE USING (
  public.is_household_member(household_id)
);
CREATE POLICY "recipes_delete_hh" ON public.recipes FOR DELETE USING (
  public.is_household_member(household_id)
);

DROP POLICY IF EXISTS "recipe_ingredients_select_hh" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_insert_hh" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_update_hh" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_delete_hh" ON public.recipe_ingredients;

CREATE POLICY "recipe_ingredients_select_hh" ON public.recipe_ingredients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_ingredients.recipe_id
    AND public.is_household_member(r.household_id)
  )
);
CREATE POLICY "recipe_ingredients_insert_hh" ON public.recipe_ingredients FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_ingredients.recipe_id
    AND public.is_household_member(r.household_id)
  )
);
CREATE POLICY "recipe_ingredients_update_hh" ON public.recipe_ingredients FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_ingredients.recipe_id
    AND public.is_household_member(r.household_id)
  )
);
CREATE POLICY "recipe_ingredients_delete_hh" ON public.recipe_ingredients FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_ingredients.recipe_id
    AND public.is_household_member(r.household_id)
  )
);

DROP POLICY IF EXISTS "meals_select_hh" ON public.meals;
DROP POLICY IF EXISTS "meals_insert_hh" ON public.meals;
DROP POLICY IF EXISTS "meals_update_hh" ON public.meals;
DROP POLICY IF EXISTS "meals_delete_hh" ON public.meals;

CREATE POLICY "meals_select_hh" ON public.meals FOR SELECT USING (
  public.is_household_member(household_id)
);
CREATE POLICY "meals_insert_hh" ON public.meals FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND public.is_household_member(household_id)
);
CREATE POLICY "meals_update_hh" ON public.meals FOR UPDATE USING (
  public.is_household_member(household_id)
);
CREATE POLICY "meals_delete_hh" ON public.meals FOR DELETE USING (
  public.is_household_member(household_id)
);

DROP POLICY IF EXISTS "meal_ingredients_select_hh" ON public.meal_ingredients;
DROP POLICY IF EXISTS "meal_ingredients_insert_hh" ON public.meal_ingredients;
DROP POLICY IF EXISTS "meal_ingredients_update_hh" ON public.meal_ingredients;
DROP POLICY IF EXISTS "meal_ingredients_delete_hh" ON public.meal_ingredients;

CREATE POLICY "meal_ingredients_select_hh" ON public.meal_ingredients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    WHERE m.id = meal_ingredients.meal_id
    AND public.is_household_member(m.household_id)
  )
);
CREATE POLICY "meal_ingredients_insert_hh" ON public.meal_ingredients FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meals m
    WHERE m.id = meal_ingredients.meal_id
    AND public.is_household_member(m.household_id)
  )
);
CREATE POLICY "meal_ingredients_update_hh" ON public.meal_ingredients FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    WHERE m.id = meal_ingredients.meal_id
    AND public.is_household_member(m.household_id)
  )
);
CREATE POLICY "meal_ingredients_delete_hh" ON public.meal_ingredients FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    WHERE m.id = meal_ingredients.meal_id
    AND public.is_household_member(m.household_id)
  )
);
