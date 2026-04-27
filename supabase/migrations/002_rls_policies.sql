-- RLS: users can only access their own data

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_item_cache ENABLE ROW LEVEL SECURITY;

-- Idempotent re-runs: existing DBs may already have these policies from manual SQL or partial migrations.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "store_profiles_select_own" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_insert_own" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_update_own" ON public.store_profiles;
DROP POLICY IF EXISTS "store_profiles_delete_own" ON public.store_profiles;
DROP POLICY IF EXISTS "list_items_select_own" ON public.list_items;
DROP POLICY IF EXISTS "list_items_insert_own" ON public.list_items;
DROP POLICY IF EXISTS "list_items_update_own" ON public.list_items;
DROP POLICY IF EXISTS "list_items_delete_own" ON public.list_items;
DROP POLICY IF EXISTS "recipes_select_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_insert_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_update_own" ON public.recipes;
DROP POLICY IF EXISTS "recipes_delete_own" ON public.recipes;
DROP POLICY IF EXISTS "recipe_ingredients_select" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_insert" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_update" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_delete" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "meals_select_own" ON public.meals;
DROP POLICY IF EXISTS "meals_insert_own" ON public.meals;
DROP POLICY IF EXISTS "meals_update_own" ON public.meals;
DROP POLICY IF EXISTS "meals_delete_own" ON public.meals;
DROP POLICY IF EXISTS "meal_ingredients_select" ON public.meal_ingredients;
DROP POLICY IF EXISTS "meal_ingredients_insert" ON public.meal_ingredients;
DROP POLICY IF EXISTS "meal_ingredients_update" ON public.meal_ingredients;
DROP POLICY IF EXISTS "meal_ingredients_delete" ON public.meal_ingredients;
DROP POLICY IF EXISTS "ai_item_cache_select" ON public.ai_item_cache;
DROP POLICY IF EXISTS "ai_item_cache_insert" ON public.ai_item_cache;
DROP POLICY IF EXISTS "ai_item_cache_update" ON public.ai_item_cache;

-- Profiles: user can read/update own row
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Store profiles
CREATE POLICY "store_profiles_select_own" ON public.store_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "store_profiles_insert_own" ON public.store_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "store_profiles_update_own" ON public.store_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "store_profiles_delete_own" ON public.store_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- List items
CREATE POLICY "list_items_select_own" ON public.list_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "list_items_insert_own" ON public.list_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "list_items_update_own" ON public.list_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "list_items_delete_own" ON public.list_items
  FOR DELETE USING (auth.uid() = user_id);

-- Recipes
CREATE POLICY "recipes_select_own" ON public.recipes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recipes_insert_own" ON public.recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_update_own" ON public.recipes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recipes_delete_own" ON public.recipes
  FOR DELETE USING (auth.uid() = user_id);

-- Recipe ingredients: via recipe ownership (user must own recipe)
CREATE POLICY "recipe_ingredients_select" ON public.recipe_ingredients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );
CREATE POLICY "recipe_ingredients_insert" ON public.recipe_ingredients
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );
CREATE POLICY "recipe_ingredients_update" ON public.recipe_ingredients
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );
CREATE POLICY "recipe_ingredients_delete" ON public.recipe_ingredients
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );

-- Meals
CREATE POLICY "meals_select_own" ON public.meals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meals_insert_own" ON public.meals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meals_update_own" ON public.meals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "meals_delete_own" ON public.meals
  FOR DELETE USING (auth.uid() = user_id);

-- Meal ingredients: via meal ownership
CREATE POLICY "meal_ingredients_select" ON public.meal_ingredients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid())
  );
CREATE POLICY "meal_ingredients_insert" ON public.meal_ingredients
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid())
  );
CREATE POLICY "meal_ingredients_update" ON public.meal_ingredients
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid())
  );
CREATE POLICY "meal_ingredients_delete" ON public.meal_ingredients
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid())
  );

-- ai_item_cache: any authenticated user can read/insert/update (shared cache by input_text)
CREATE POLICY "ai_item_cache_select" ON public.ai_item_cache
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_item_cache_insert" ON public.ai_item_cache
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ai_item_cache_update" ON public.ai_item_cache
  FOR UPDATE TO authenticated USING (true);
