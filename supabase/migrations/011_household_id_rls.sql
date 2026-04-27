-- Scope entity tables by household_id; RLS via household membership

ALTER TABLE public.store_profiles
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id);
ALTER TABLE public.list_items
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id);
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id);
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id);

UPDATE public.store_profiles sp
SET household_id = (
  SELECT hm.household_id FROM public.household_members hm
  WHERE hm.user_id = sp.user_id
  ORDER BY hm.created_at ASC
  LIMIT 1
)
WHERE sp.household_id IS NULL;

UPDATE public.list_items li
SET household_id = (
  SELECT hm.household_id FROM public.household_members hm
  WHERE hm.user_id = li.user_id
  ORDER BY hm.created_at ASC
  LIMIT 1
)
WHERE li.household_id IS NULL;

UPDATE public.recipes r
SET household_id = (
  SELECT hm.household_id FROM public.household_members hm
  WHERE hm.user_id = r.user_id
  ORDER BY hm.created_at ASC
  LIMIT 1
)
WHERE r.household_id IS NULL;

UPDATE public.meals m
SET household_id = (
  SELECT hm.household_id FROM public.household_members hm
  WHERE hm.user_id = m.user_id
  ORDER BY hm.created_at ASC
  LIMIT 1
)
WHERE m.household_id IS NULL;

ALTER TABLE public.store_profiles ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE public.list_items ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE public.recipes ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE public.meals ALTER COLUMN household_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_profiles_household_id ON public.store_profiles(household_id);
CREATE INDEX IF NOT EXISTS idx_list_items_household_id ON public.list_items(household_id);
CREATE INDEX IF NOT EXISTS idx_recipes_household_id ON public.recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_meals_household_id ON public.meals(household_id);

-- One default store per household (replace per-user unique index)
DROP INDEX IF EXISTS public.idx_store_profiles_one_default_per_user;
UPDATE public.store_profiles SET is_default = false;
UPDATE public.store_profiles sp
SET is_default = true
FROM (
  SELECT DISTINCT ON (household_id) id
  FROM public.store_profiles
  ORDER BY household_id, created_at ASC NULLS LAST, id ASC
) pick
WHERE sp.id = pick.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_profiles_one_default_per_household
  ON public.store_profiles (household_id)
  WHERE (is_default = true);

-- Replace user-only RLS with household membership

DROP POLICY IF EXISTS "store_profiles_select_own" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_insert_own" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_update_own" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_delete_own" ON public.store_profiles;

CREATE POLICY "store_profiles_select_hh" ON public.store_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = store_profiles.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "store_profiles_insert_hh" ON public.store_profiles FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = store_profiles.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "store_profiles_update_hh" ON public.store_profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = store_profiles.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "store_profiles_delete_hh" ON public.store_profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = store_profiles.household_id AND hm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "list_items_select_own" ON public.list_items;
DROP POLICY IF EXISTS "list_items_insert_own" ON public.list_items;
DROP POLICY IF EXISTS "list_items_update_own" ON public.list_items;
DROP POLICY IF EXISTS "list_items_delete_own" ON public.list_items;

CREATE POLICY "list_items_select_hh" ON public.list_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = list_items.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "list_items_insert_hh" ON public.list_items FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = list_items.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "list_items_update_hh" ON public.list_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = list_items.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "list_items_delete_hh" ON public.list_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = list_items.household_id AND hm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "recipes_select_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_insert_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_update_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_delete_own" ON public.recipes;

CREATE POLICY "recipes_select_hh" ON public.recipes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = recipes.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "recipes_insert_hh" ON public.recipes FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = recipes.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "recipes_update_hh" ON public.recipes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = recipes.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "recipes_delete_hh" ON public.recipes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = recipes.household_id AND hm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "recipe_ingredients_select" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_insert" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_update" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_delete" ON public.recipe_ingredients;

CREATE POLICY "recipe_ingredients_select_hh" ON public.recipe_ingredients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    INNER JOIN public.household_members hm ON hm.household_id = r.household_id AND hm.user_id = auth.uid()
    WHERE r.id = recipe_ingredients.recipe_id
  )
);
CREATE POLICY "recipe_ingredients_insert_hh" ON public.recipe_ingredients FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipes r
    INNER JOIN public.household_members hm ON hm.household_id = r.household_id AND hm.user_id = auth.uid()
    WHERE r.id = recipe_ingredients.recipe_id
  )
);
CREATE POLICY "recipe_ingredients_update_hh" ON public.recipe_ingredients FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    INNER JOIN public.household_members hm ON hm.household_id = r.household_id AND hm.user_id = auth.uid()
    WHERE r.id = recipe_ingredients.recipe_id
  )
);
CREATE POLICY "recipe_ingredients_delete_hh" ON public.recipe_ingredients FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.recipes r
    INNER JOIN public.household_members hm ON hm.household_id = r.household_id AND hm.user_id = auth.uid()
    WHERE r.id = recipe_ingredients.recipe_id
  )
);

DROP POLICY IF EXISTS "meals_select_own" ON public.meals;
DROP POLICY IF EXISTS "meals_insert_own" ON public.meals;
DROP POLICY IF EXISTS "meals_update_own" ON public.meals;
DROP POLICY IF EXISTS "meals_delete_own" ON public.meals;

CREATE POLICY "meals_select_hh" ON public.meals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = meals.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "meals_insert_hh" ON public.meals FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = meals.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "meals_update_hh" ON public.meals FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = meals.household_id AND hm.user_id = auth.uid())
);
CREATE POLICY "meals_delete_hh" ON public.meals FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = meals.household_id AND hm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "meal_ingredients_select" ON public.meal_ingredients;
DROP POLICY IF EXISTS "meal_ingredients_insert" ON public.meal_ingredients;
DROP POLICY IF EXISTS "meal_ingredients_update" ON public.meal_ingredients;
DROP POLICY IF EXISTS "meal_ingredients_delete" ON public.meal_ingredients;

CREATE POLICY "meal_ingredients_select_hh" ON public.meal_ingredients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    INNER JOIN public.household_members hm ON hm.household_id = m.household_id AND hm.user_id = auth.uid()
    WHERE m.id = meal_ingredients.meal_id
  )
);
CREATE POLICY "meal_ingredients_insert_hh" ON public.meal_ingredients FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meals m
    INNER JOIN public.household_members hm ON hm.household_id = m.household_id AND hm.user_id = auth.uid()
    WHERE m.id = meal_ingredients.meal_id
  )
);
CREATE POLICY "meal_ingredients_update_hh" ON public.meal_ingredients FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    INNER JOIN public.household_members hm ON hm.household_id = m.household_id AND hm.user_id = auth.uid()
    WHERE m.id = meal_ingredients.meal_id
  )
);
CREATE POLICY "meal_ingredients_delete_hh" ON public.meal_ingredients FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    INNER JOIN public.household_members hm ON hm.household_id = m.household_id AND hm.user_id = auth.uid()
    WHERE m.id = meal_ingredients.meal_id
  )
);
