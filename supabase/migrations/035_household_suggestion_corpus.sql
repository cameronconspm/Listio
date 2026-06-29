-- Household suggestion corpus for quick-add autocomplete index rebuild.
-- Returns distinct normalized item names from lists, recipes, and meals.

CREATE OR REPLACE FUNCTION public.fetch_household_suggestion_corpus(
  p_household_id uuid,
  p_limit int DEFAULT 2000
)
RETURNS TABLE (
  normalized_name text,
  display_name text,
  source text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH list_rows AS (
    SELECT DISTINCT ON (lower(trim(li.normalized_name)))
      lower(trim(li.normalized_name)) AS normalized_name,
      trim(li.name) AS display_name,
      'list'::text AS source
    FROM public.list_items li
    WHERE li.household_id = p_household_id
      AND trim(coalesce(li.name, '')) <> ''
      AND trim(coalesce(li.normalized_name, '')) <> ''
    ORDER BY lower(trim(li.normalized_name)), li.updated_at DESC NULLS LAST
  ),
  recipe_rows AS (
    SELECT DISTINCT ON (lower(trim(ri.name)))
      lower(trim(regexp_replace(trim(ri.name), E'\\s+', ' ', 'g'))) AS normalized_name,
      trim(ri.name) AS display_name,
      'recipe'::text AS source
    FROM public.recipe_ingredients ri
    INNER JOIN public.recipes r ON r.id = ri.recipe_id
    WHERE r.household_id = p_household_id
      AND trim(coalesce(ri.name, '')) <> ''
    ORDER BY lower(trim(ri.name)), ri.id DESC
  ),
  meal_rows AS (
    SELECT DISTINCT ON (lower(trim(coalesce(mi.normalized_name, mi.name))))
      lower(trim(coalesce(mi.normalized_name, mi.name))) AS normalized_name,
      trim(mi.name) AS display_name,
      'meal'::text AS source
    FROM public.meal_ingredients mi
    INNER JOIN public.meals m ON m.id = mi.meal_id
    WHERE m.household_id = p_household_id
      AND trim(coalesce(mi.name, '')) <> ''
    ORDER BY lower(trim(coalesce(mi.normalized_name, mi.name))), mi.id DESC
  ),
  combined AS (
    SELECT * FROM list_rows
    UNION ALL
    SELECT * FROM recipe_rows
    UNION ALL
    SELECT * FROM meal_rows
  )
  SELECT DISTINCT ON (c.normalized_name)
    c.normalized_name,
    c.display_name,
    c.source
  FROM combined c
  WHERE c.normalized_name <> ''
  ORDER BY c.normalized_name, c.source
  LIMIT greatest(1, least(coalesce(p_limit, 2000), 5000));
$$;

GRANT EXECUTE ON FUNCTION public.fetch_household_suggestion_corpus(uuid, int) TO authenticated;
