-- Speeds up the Recipes tab by (1) storing ingredient_count on recipes so the
-- client can sort/paginate without an extra recipe_ingredients round-trip, and
-- (2) adding a tsvector search index covering recipe names + ingredient names
-- so search is offloaded from the client (lazy-fetch can be skipped entirely).

-- 1) ingredient_count column -------------------------------------------------

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS ingredient_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recipe_ingredients_count_refresh(p_recipe_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.recipes r
  SET ingredient_count = (
    SELECT COUNT(*)
    FROM public.recipe_ingredients ri
    WHERE ri.recipe_id = r.id
  )
  WHERE r.id = p_recipe_id;
$$;

CREATE OR REPLACE FUNCTION public.recipe_ingredients_count_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recipe_ingredients_count_refresh(OLD.recipe_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.recipe_id IS DISTINCT FROM OLD.recipe_id THEN
      PERFORM public.recipe_ingredients_count_refresh(OLD.recipe_id);
    END IF;
    PERFORM public.recipe_ingredients_count_refresh(NEW.recipe_id);
    RETURN NEW;
  ELSE
    PERFORM public.recipe_ingredients_count_refresh(NEW.recipe_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS recipe_ingredients_count_after_change
  ON public.recipe_ingredients;

CREATE TRIGGER recipe_ingredients_count_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.recipe_ingredients
FOR EACH ROW EXECUTE FUNCTION public.recipe_ingredients_count_trg();

-- Backfill existing rows once.
UPDATE public.recipes r
SET ingredient_count = (
  SELECT COUNT(*)
  FROM public.recipe_ingredients ri
  WHERE ri.recipe_id = r.id
);

CREATE INDEX IF NOT EXISTS idx_recipes_ingredient_count
  ON public.recipes(ingredient_count DESC);

-- 2) tsvector search ---------------------------------------------------------

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS search_tsv tsvector;

CREATE OR REPLACE FUNCTION public.recipe_search_tsv_refresh(p_recipe_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.recipes r
  SET search_tsv =
    setweight(to_tsvector('simple', coalesce(r.name, '')), 'A') ||
    setweight(
      to_tsvector(
        'simple',
        coalesce(
          (
            SELECT string_agg(ri.name, ' ')
            FROM public.recipe_ingredients ri
            WHERE ri.recipe_id = r.id
          ),
          ''
        )
      ),
      'B'
    )
  WHERE r.id = p_recipe_id;
$$;

CREATE OR REPLACE FUNCTION public.recipes_search_tsv_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name) THEN
    PERFORM public.recipe_search_tsv_refresh(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipes_search_tsv_after_change ON public.recipes;

CREATE TRIGGER recipes_search_tsv_after_change
AFTER INSERT OR UPDATE OF name ON public.recipes
FOR EACH ROW EXECUTE FUNCTION public.recipes_search_tsv_trg();

CREATE OR REPLACE FUNCTION public.recipe_ingredients_search_tsv_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recipe_search_tsv_refresh(OLD.recipe_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.recipe_id IS DISTINCT FROM OLD.recipe_id THEN
      PERFORM public.recipe_search_tsv_refresh(OLD.recipe_id);
    END IF;
    PERFORM public.recipe_search_tsv_refresh(NEW.recipe_id);
    RETURN NEW;
  ELSE
    PERFORM public.recipe_search_tsv_refresh(NEW.recipe_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS recipe_ingredients_search_tsv_after_change
  ON public.recipe_ingredients;

CREATE TRIGGER recipe_ingredients_search_tsv_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.recipe_ingredients
FOR EACH ROW EXECUTE FUNCTION public.recipe_ingredients_search_tsv_trg();

-- Backfill search_tsv for existing rows.
UPDATE public.recipes r
SET search_tsv =
  setweight(to_tsvector('simple', coalesce(r.name, '')), 'A') ||
  setweight(
    to_tsvector(
      'simple',
      coalesce(
        (
          SELECT string_agg(ri.name, ' ')
          FROM public.recipe_ingredients ri
          WHERE ri.recipe_id = r.id
        ),
        ''
      )
    ),
    'B'
  );

CREATE INDEX IF NOT EXISTS idx_recipes_search_tsv
  ON public.recipes USING gin(search_tsv);

-- 3) search RPC --------------------------------------------------------------

-- Returns recipe ids matching the query, ordered by relevance.
-- The client filters the already-loaded recipe list by this id set, keeping
-- authorization (RLS) centered on the normal recipes table policies.
CREATE OR REPLACE FUNCTION public.search_recipe_ids(
  p_household_id uuid,
  p_query text,
  p_limit int DEFAULT 200
)
RETURNS TABLE (id uuid, rank real)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('simple', coalesce(p_query, '')) AS tsq
  )
  SELECT r.id,
         ts_rank_cd(r.search_tsv, q.tsq) AS rank
  FROM public.recipes r, q
  WHERE r.household_id = p_household_id
    AND r.search_tsv @@ q.tsq
  ORDER BY rank DESC, r.updated_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 200), 500));
$$;

GRANT EXECUTE ON FUNCTION public.search_recipe_ids(uuid, text, int) TO authenticated;
