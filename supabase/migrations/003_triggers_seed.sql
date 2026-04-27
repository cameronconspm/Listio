-- updated_at trigger for list_items (and optionally store_profiles, recipes, meals)

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- list_items
DROP TRIGGER IF EXISTS list_items_updated_at ON public.list_items;
CREATE TRIGGER list_items_updated_at
  BEFORE UPDATE ON public.list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- store_profiles
DROP TRIGGER IF EXISTS store_profiles_updated_at ON public.store_profiles;
CREATE TRIGGER store_profiles_updated_at
  BEFORE UPDATE ON public.store_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- recipes
DROP TRIGGER IF EXISTS recipes_updated_at ON public.recipes;
CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- meals
DROP TRIGGER IF EXISTS meals_updated_at ON public.meals;
CREATE TRIGGER meals_updated_at
  BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: no DB seed for default store; app calls ensureDefaultStore on first login.
