-- Backward compatibility for App Store builds that insert list_items without list_id
-- (pre-shopping_lists client). Migration 031 made list_id NOT NULL; this trigger
-- resolves the household default shopping list before insert so legacy clients keep working.

-- Repair any households created after 031 that never received a default list.
INSERT INTO public.shopping_lists (household_id, name, is_default, sort_order)
SELECT h.id, 'Groceries', true, 0
FROM public.households h
WHERE NOT EXISTS (
  SELECT 1 FROM public.shopping_lists sl WHERE sl.household_id = h.id
);

CREATE OR REPLACE FUNCTION public.ensure_list_item_list_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hid uuid;
  lid uuid;
BEGIN
  IF NEW.list_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  hid := NEW.household_id;
  IF hid IS NULL THEN
    RAISE EXCEPTION 'list_items.household_id is required when list_id is omitted';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_household_member(hid) THEN
    RAISE EXCEPTION 'not a household member';
  END IF;

  SELECT sl.id INTO lid
  FROM public.shopping_lists sl
  WHERE sl.household_id = hid
    AND sl.is_default = true
  LIMIT 1;

  IF lid IS NULL THEN
    SELECT sl.id INTO lid
    FROM public.shopping_lists sl
    WHERE sl.household_id = hid
    ORDER BY sl.created_at ASC, sl.id ASC
    LIMIT 1;
  END IF;

  IF lid IS NULL THEN
    INSERT INTO public.shopping_lists (household_id, name, is_default, sort_order)
    VALUES (hid, 'Groceries', true, 0)
    RETURNING id INTO lid;
  END IF;

  NEW.list_id := lid;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS list_items_ensure_list_id ON public.list_items;
CREATE TRIGGER list_items_ensure_list_id
  BEFORE INSERT ON public.list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_list_item_list_id();
