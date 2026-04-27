-- Add is_favorite, category, and last_used_at to recipes
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IS NULL OR category IN ('breakfast','lunch','dinner','dessert','snack','other')),
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
