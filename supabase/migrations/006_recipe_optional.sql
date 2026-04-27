-- Add optional recipe_url and notes to recipes
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS recipe_url text,
  ADD COLUMN IF NOT EXISTS notes text;
