-- Recipe instructions (step-by-step) and optional total time for UI pills.

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS total_time_minutes int;

UPDATE public.recipes SET instructions = left(instructions, 20000)
  WHERE instructions IS NOT NULL AND char_length(instructions) > 20000;

ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_instructions_len;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_instructions_len
  CHECK (instructions IS NULL OR char_length(instructions) <= 20000);

ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_total_time_minutes_range;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_total_time_minutes_range
  CHECK (
    total_time_minutes IS NULL
    OR (total_time_minutes >= 0 AND total_time_minutes <= 10080)
  );
