-- Meals planner: add meal_date, meal_slot, custom slots, recipe_url, notes
-- meal_ingredients: add normalized_name, brand_preference
-- Keeps start_date/end_date for rollback; app reads meal_date/meal_slot

-- 1. Add new columns to meals (nullable initially)
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS meal_date date,
  ADD COLUMN IF NOT EXISTS meal_slot text,
  ADD COLUMN IF NOT EXISTS custom_slot_name text,
  ADD COLUMN IF NOT EXISTS recipe_url text,
  ADD COLUMN IF NOT EXISTS notes text;

-- 2. Backfill existing meals
UPDATE public.meals
SET
  meal_date = COALESCE(start_date, end_date, CURRENT_DATE),
  meal_slot = 'dinner',
  custom_slot_name = NULL,
  recipe_url = NULL,
  notes = NULL
WHERE meal_date IS NULL OR meal_slot IS NULL;

-- 3. Make meal_date and meal_slot required with defaults
ALTER TABLE public.meals
  ALTER COLUMN meal_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN meal_slot SET DEFAULT 'dinner';

UPDATE public.meals SET meal_date = CURRENT_DATE WHERE meal_date IS NULL;
UPDATE public.meals SET meal_slot = 'dinner' WHERE meal_slot IS NULL;

ALTER TABLE public.meals
  ALTER COLUMN meal_date SET NOT NULL,
  ALTER COLUMN meal_slot SET NOT NULL;

-- 4. Add check constraint for meal_slot
ALTER TABLE public.meals
  DROP CONSTRAINT IF EXISTS meals_meal_slot_check;

ALTER TABLE public.meals
  ADD CONSTRAINT meals_meal_slot_check
  CHECK (meal_slot IN ('breakfast', 'lunch', 'dinner', 'dessert', 'custom'));

-- 5. Add index for date-range queries
CREATE INDEX IF NOT EXISTS idx_meals_user_date
  ON public.meals (user_id, meal_date);

-- 6. Add normalized_name and brand_preference to meal_ingredients
ALTER TABLE public.meal_ingredients
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS brand_preference text;

-- 7. Backfill normalized_name for existing meal_ingredients
UPDATE public.meal_ingredients
SET normalized_name = lower(trim(regexp_replace(name, E'\\s+', ' ', 'g')))
WHERE normalized_name IS NULL AND name IS NOT NULL;

-- 8. For any remaining nulls (empty name edge case), use empty string
UPDATE public.meal_ingredients
SET normalized_name = ''
WHERE normalized_name IS NULL;

ALTER TABLE public.meal_ingredients
  ALTER COLUMN normalized_name SET NOT NULL,
  ALTER COLUMN normalized_name SET DEFAULT '';
