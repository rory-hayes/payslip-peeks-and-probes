-- Rate-limit buckets are operational counters, not account history. They have
-- no foreign key because their key is intentionally opaque, so expire them at
-- the server boundary as well as removing the exact bucket on account delete.

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket_key text,
  p_window_start timestamptz,
  p_max_per_window integer
)
RETURNS TABLE(allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_count integer;
BEGIN
  IF p_max_per_window < 1 THEN
    RAISE EXCEPTION 'p_max_per_window must be positive';
  END IF;

  -- Current payslip processing uses one-hour buckets. Retaining a little
  -- extra time keeps retry diagnostics possible without retaining an
  -- account-correlated key indefinitely.
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '48 hours';

  INSERT INTO public.rate_limits (bucket_key, window_start, count)
  VALUES (p_bucket_key, p_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO next_count;

  RETURN QUERY SELECT next_count <= p_max_per_window, next_count;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, timestamptz, integer) TO service_role;
