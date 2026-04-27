-- Per-user per-minute rate limits for place-search / places-nearby Edge Functions (service role RPC only).

CREATE TABLE IF NOT EXISTS public.edge_places_rate_buckets (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fn text NOT NULL CHECK (fn IN ('place-search', 'places-nearby')),
  bucket_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, fn, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_edge_places_rate_buckets_prune ON public.edge_places_rate_buckets (bucket_start);

ALTER TABLE public.edge_places_rate_buckets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.edge_places_rate_buckets IS 'Rolling minute buckets for Edge place-search/places-nearby; no client access (service role only).';

CREATE OR REPLACE FUNCTION public.places_rate_limit_consume(p_user_id uuid, p_fn text, p_limit int)
RETURNS TABLE(allowed boolean, current_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b timestamptz := date_trunc('minute', timezone('utc', now()));
  c int;
BEGIN
  IF p_fn NOT IN ('place-search', 'places-nearby') OR p_limit < 1 THEN
    RETURN QUERY
    SELECT false, 0;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(
    abs(hashtext(p_user_id::text))::integer,
    abs(hashtext(p_fn || '#' || (extract(epoch FROM b)::bigint)::text))::integer
  );

  SELECT t.count INTO c
  FROM public.edge_places_rate_buckets t
  WHERE t.user_id = p_user_id AND t.fn = p_fn AND t.bucket_start = b;

  IF c IS NULL THEN
    c := 0;
  END IF;

  IF c >= p_limit THEN
    RETURN QUERY
    SELECT false, c;
    RETURN;
  END IF;

  INSERT INTO public.edge_places_rate_buckets (user_id, fn, bucket_start, count)
  VALUES (p_user_id, p_fn, b, 1)
  ON CONFLICT (user_id, fn, bucket_start)
  DO UPDATE SET count = public.edge_places_rate_buckets.count + 1
  RETURNING count INTO c;

  RETURN QUERY
  SELECT true, c;
END;
$$;

REVOKE ALL ON FUNCTION public.places_rate_limit_consume(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.places_rate_limit_consume(uuid, text, int) TO service_role;

COMMENT ON FUNCTION public.places_rate_limit_consume IS 'Atomically increment counter for UTC minute bucket; returns allowed=false if at/over limit. Edge + service role only.';
