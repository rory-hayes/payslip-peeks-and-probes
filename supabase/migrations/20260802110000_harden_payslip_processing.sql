-- Production hardening for sensitive payslip processing.
--
-- These constraints protect the privileged Edge Function from being pointed at
-- another account's private object, make a processing claim one-time/atomic,
-- and make rate-limit increments race-safe.

ALTER TABLE public.payslips
  ADD CONSTRAINT payslips_file_path_owned_by_row_user
  CHECK (
    file_path IS NULL
    OR file_path LIKE (user_id::text || '/%')
  );

ALTER TABLE public.payslips
  ADD COLUMN processing_started_at timestamptz,
  ADD COLUMN processing_finished_at timestamptz,
  ADD COLUMN processing_attempts integer NOT NULL DEFAULT 0
    CHECK (processing_attempts >= 0),
  ADD COLUMN processing_failure_code text;

CREATE OR REPLACE FUNCTION public.claim_payslip_processing(
  p_payslip_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed boolean;
BEGIN
  UPDATE public.payslips
  SET
    processing_started_at = now(),
    processing_finished_at = null,
    processing_failure_code = null,
    processing_attempts = processing_attempts + 1
  WHERE id = p_payslip_id
    AND user_id = p_user_id
    AND status = 'processing'
    AND processing_started_at IS NULL
  RETURNING true INTO claimed;

  RETURN coalesce(claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payslip_processing(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_payslip_processing(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket_key text,
  p_window_start timestamptz,
  p_max_per_window integer
)
RETURNS TABLE(allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_count integer;
BEGIN
  IF p_max_per_window < 1 THEN
    RAISE EXCEPTION 'p_max_per_window must be positive';
  END IF;

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
