-- Listio schema: profiles, store_profiles, list_items, recipes, meals, ai_item_cache

-- Zone and store type allowed values (text + check)
-- Zone keys: produce, bakery_deli, meat_seafood, dairy_eggs, frozen, pantry,
--            snacks_drinks, household_cleaning, personal_care, other
-- Store types: generic, kroger_style, albertsons_style, wholefoods_style, costco_style, traderjoes_style

-- Profiles: 1:1 with auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Store profiles: user's store configs and zone order
CREATE TABLE IF NOT EXISTS public.store_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Store',
  store_type text NOT NULL DEFAULT 'generic'
    CHECK (store_type IN ('generic','kroger_style','albertsons_style','wholefoods_style','costco_style','traderjoes_style')),
  zone_order jsonb NOT NULL DEFAULT '["produce","bakery_deli","meat_seafood","dairy_eggs","frozen","pantry","snacks_drinks","household_cleaning","personal_care","other"]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_profiles_one_default_per_user
  ON public.store_profiles (user_id) WHERE (is_default = true);

CREATE INDEX IF NOT EXISTS idx_store_profiles_user_id ON public.store_profiles(user_id);

-- List items
CREATE TABLE IF NOT EXISTS public.list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  category text NOT NULL DEFAULT '',
  zone_key text NOT NULL DEFAULT 'other'
    CHECK (zone_key IN ('produce','bakery_deli','meat_seafood','dairy_eggs','frozen','pantry','snacks_drinks','household_cleaning','personal_care','other')),
  quantity_value numeric,
  quantity_unit text,
  notes text,
  is_checked boolean NOT NULL DEFAULT false,
  linked_meal_ids uuid[] NOT NULL DEFAULT '{}',
  brand_preference text,
  substitute_allowed boolean NOT NULL DEFAULT true,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  is_recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_list_items_user_id ON public.list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_user_zone ON public.list_items(user_id, zone_key);

-- Recipes
CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  servings int NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON public.recipes(user_id);

-- Recipe ingredients
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity_value numeric,
  quantity_unit text,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON public.recipe_ingredients(recipe_id);

-- Meals
CREATE TABLE IF NOT EXISTS public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meals_user_id ON public.meals(user_id);

-- Meal ingredients
CREATE TABLE IF NOT EXISTS public.meal_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity_value numeric,
  quantity_unit text,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_meal_ingredients_meal_id ON public.meal_ingredients(meal_id);

-- AI item cache: shared by input_text, used by categorize-items Edge Function
CREATE TABLE IF NOT EXISTS public.ai_item_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_text text NOT NULL,
  normalized_name text NOT NULL,
  category text NOT NULL,
  zone_key text NOT NULL
    CHECK (zone_key IN ('produce','bakery_deli','meat_seafood','dairy_eggs','frozen','pantry','snacks_drinks','household_cleaning','personal_care','other')),
  confidence numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(input_text)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_item_cache_input_lower ON public.ai_item_cache(lower(input_text));

-- Trigger to create profile on signup (so RLS and FKs work)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
