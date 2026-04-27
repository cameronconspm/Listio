-- Phase 2: Add optional metadata columns to list_items
ALTER TABLE public.list_items
  ADD COLUMN IF NOT EXISTS brand_preference text,
  ADD COLUMN IF NOT EXISTS substitute_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
