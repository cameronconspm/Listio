-- Shopping lists: parent entity for list_items (one default list per household).

CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Groceries',
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_lists_one_default_per_household
  ON public.shopping_lists (household_id) WHERE (is_default = true);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_household_id
  ON public.shopping_lists(household_id);

ALTER TABLE public.list_items
  ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES public.shopping_lists(id) ON DELETE CASCADE;

INSERT INTO public.shopping_lists (household_id, name, is_default)
SELECT DISTINCT li.household_id, 'Groceries', true
FROM public.list_items li
WHERE NOT EXISTS (
  SELECT 1 FROM public.shopping_lists sl WHERE sl.household_id = li.household_id
);

UPDATE public.list_items li
SET list_id = sl.id
FROM public.shopping_lists sl
WHERE sl.household_id = li.household_id
  AND sl.is_default = true
  AND li.list_id IS NULL;

INSERT INTO public.shopping_lists (household_id, name, is_default)
SELECT h.id, 'Groceries', true
FROM public.households h
WHERE NOT EXISTS (
  SELECT 1 FROM public.shopping_lists sl WHERE sl.household_id = h.id
);

ALTER TABLE public.list_items ALTER COLUMN list_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_zone ON public.list_items(list_id, zone_key);

DROP TRIGGER IF EXISTS shopping_lists_updated_at ON public.shopping_lists;
CREATE TRIGGER shopping_lists_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopping_lists_select_hh" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_insert_hh" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_update_hh" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_delete_hh" ON public.shopping_lists;

CREATE POLICY "shopping_lists_select_hh" ON public.shopping_lists FOR SELECT USING (
  public.is_household_member(household_id)
);
CREATE POLICY "shopping_lists_insert_hh" ON public.shopping_lists FOR INSERT WITH CHECK (
  public.is_household_member(household_id)
);
CREATE POLICY "shopping_lists_update_hh" ON public.shopping_lists FOR UPDATE USING (
  public.is_household_member(household_id)
);
CREATE POLICY "shopping_lists_delete_hh" ON public.shopping_lists FOR DELETE USING (
  public.is_household_member(household_id)
);

DROP POLICY IF EXISTS "list_items_select_hh" ON public.list_items;
DROP POLICY IF EXISTS "list_items_insert_hh" ON public.list_items;
DROP POLICY IF EXISTS "list_items_update_hh" ON public.list_items;
DROP POLICY IF EXISTS "list_items_delete_hh" ON public.list_items;

CREATE POLICY "list_items_select_hh" ON public.list_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.shopping_lists sl
    WHERE sl.id = list_items.list_id
      AND public.is_household_member(sl.household_id)
  )
);
CREATE POLICY "list_items_insert_hh" ON public.list_items FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND public.is_household_member(household_id)
  AND EXISTS (
    SELECT 1 FROM public.shopping_lists sl
    WHERE sl.id = list_items.list_id
      AND sl.household_id = list_items.household_id
      AND public.is_household_member(sl.household_id)
  )
);
CREATE POLICY "list_items_update_hh" ON public.list_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.shopping_lists sl
    WHERE sl.id = list_items.list_id
      AND public.is_household_member(sl.household_id)
  )
);
CREATE POLICY "list_items_delete_hh" ON public.list_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.shopping_lists sl
    WHERE sl.id = list_items.list_id
      AND public.is_household_member(sl.household_id)
  )
);
