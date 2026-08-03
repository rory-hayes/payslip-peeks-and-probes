-- Free access is three automatic payslip checks per Europe/Dublin calendar
-- month, not three browser-created rows. Keep the cost-control record outside
-- the deletable payslip row: a person may remove a failed private document,
-- but that must not erase an automatic check that already reached a provider.
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS processing_token uuid,
  ADD COLUMN IF NOT EXISTS provider_started_at timestamptz;

ALTER TABLE public.payslip_extractions
  ADD COLUMN IF NOT EXISTS processing_token uuid;

CREATE TABLE IF NOT EXISTS public.payslip_check_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payslip_id uuid REFERENCES public.payslips(id) ON DELETE SET NULL,
  period date NOT NULL,
  provider_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payslip_check_reservations_payslip_id_key
  ON public.payslip_check_reservations (payslip_id)
  WHERE payslip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payslip_check_reservations_user_period_idx
  ON public.payslip_check_reservations (user_id, period);

ALTER TABLE public.payslip_check_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payslip check reservations" ON public.payslip_check_reservations;
CREATE POLICY "Users can view own payslip check reservations"
  ON public.payslip_check_reservations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Payslip records bind a processing attempt to one private object key. The
-- clients already create unique keys with upsert disabled, so owners never
-- need to replace an object in place; keeping objects immutable prevents one
-- free-check reservation from being reused for different documents.
DROP POLICY IF EXISTS "Users can update own payslips" ON storage.objects;

-- This is the sole paid/free claim path. It serialises a person's allowance,
-- creates a non-deletable free-check reservation when needed, assigns a fresh
-- fencing token, and prepares the extraction row in one transaction.
CREATE OR REPLACE FUNCTION public.reserve_and_claim_payslip_processing(
  p_payslip_id uuid,
  p_user_id uuid,
  p_environment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payslip public.payslips%ROWTYPE;
  v_period date := date_trunc('month', timezone('Europe/Dublin', now()))::date;
  v_has_premium boolean := false;
  v_reservation_id uuid;
  v_free_reservations integer := 0;
  v_processing_token uuid := gen_random_uuid();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_payslip_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'A payslip and user are required';
  END IF;
  IF p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Invalid billing environment';
  END IF;

  -- Serialise the account's current-month free-check reservation. A retry of
  -- the same payslip reuses its existing reservation and does not take a new
  -- allowance slot.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':' || v_period::text)::bigint
  );

  SELECT p.* INTO v_payslip
  FROM public.payslips AS p
  WHERE p.id = p_payslip_id
    AND p.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_payslip.status <> 'processing' THEN
    RETURN jsonb_build_object('status', 'conflict');
  END IF;
  IF v_payslip.processing_attempts >= 3 THEN
    UPDATE public.payslips
    SET
      status = 'failed',
      processing_finished_at = now(),
      processing_failure_code = 'processing_attempt_limit',
      processing_token = null
    WHERE id = p_payslip_id
      AND user_id = p_user_id
      AND status = 'processing';
    RETURN jsonb_build_object('status', 'attempt_limit');
  END IF;
  IF v_payslip.processing_started_at IS NOT NULL
    AND v_payslip.processing_started_at >= now() - interval '20 minutes' THEN
    RETURN jsonb_build_object('status', 'already_processing');
  END IF;
  IF v_payslip.processing_started_at IS NOT NULL
    AND v_payslip.provider_started_at IS NOT NULL THEN
    -- The old worker may still receive a provider response. Do not send a
    -- duplicate private document automatically; fence it out and let the
    -- owner explicitly choose a retry or manual review from the failed state.
    UPDATE public.payslips
    SET
      status = 'failed',
      processing_finished_at = now(),
      processing_failure_code = 'processing_stalled_after_dispatch',
      processing_token = null
    WHERE id = p_payslip_id
      AND user_id = p_user_id
      AND status = 'processing'
      AND processing_token = v_payslip.processing_token;

    UPDATE public.payslip_extractions
    SET
      extraction_status = 'failed',
      raw_extraction_json = null,
      processing_token = null
    WHERE payslip_id = p_payslip_id
      AND processing_token = v_payslip.processing_token;

    RETURN jsonb_build_object('status', 'stalled_after_dispatch');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions AS s
    WHERE s.user_id = p_user_id
      AND s.environment = p_environment
      AND (
        (
          (s.price_id IN ('lifetime_once', 'lifetime_once_gbp')
            OR s.product_id IN ('lifetime', 'lifetime_plan'))
          AND s.status = 'active'
        )
        OR (
          s.price_id IN ('plus_yearly', 'plus_monthly', 'plus_yearly_gbp', 'plus_monthly_gbp')
          AND s.status IN ('active', 'trialing', 'canceled')
          AND s.current_period_end > now()
        )
      )
  ) INTO v_has_premium;

  IF NOT v_has_premium THEN
    SELECT r.id INTO v_reservation_id
    FROM public.payslip_check_reservations AS r
    WHERE r.payslip_id = p_payslip_id
    FOR UPDATE;

    IF v_reservation_id IS NULL THEN
      SELECT count(*)::integer INTO v_free_reservations
      FROM public.payslip_check_reservations AS r
      WHERE r.user_id = p_user_id
        AND r.period = v_period;

      IF v_free_reservations >= 3 THEN
        UPDATE public.payslips
        SET
          status = 'failed',
          processing_finished_at = now(),
          processing_failure_code = 'monthly_upload_limit',
          processing_token = null
        WHERE id = p_payslip_id
          AND user_id = p_user_id
          AND status = 'processing';
        RETURN jsonb_build_object('status', 'quota_exceeded');
      END IF;

      INSERT INTO public.payslip_check_reservations (user_id, payslip_id, period)
      VALUES (p_user_id, p_payslip_id, v_period);
    END IF;
  END IF;

  UPDATE public.payslips
  SET
    processing_started_at = now(),
    processing_finished_at = null,
    processing_failure_code = null,
    processing_attempts = processing_attempts + 1,
    processing_token = v_processing_token,
    provider_started_at = null
  WHERE id = p_payslip_id
    AND user_id = p_user_id
    AND status = 'processing'
    AND processing_attempts < 3
    AND (
      processing_started_at IS NULL
      OR processing_started_at < now() - interval '20 minutes'
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'conflict');
  END IF;

  -- There is no database uniqueness constraint on legacy extraction rows, so
  -- update every existing row before creating one only when none exists.
  UPDATE public.payslip_extractions
  SET
    extraction_status = 'pending',
    raw_extraction_json = null,
    processing_token = v_processing_token
  WHERE payslip_id = p_payslip_id;

  IF NOT FOUND THEN
    INSERT INTO public.payslip_extractions (payslip_id, extraction_status, processing_token)
    VALUES (p_payslip_id, 'pending', v_processing_token);
  END IF;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'processing_token', v_processing_token::text
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_and_claim_payslip_processing(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_and_claim_payslip_processing(uuid, uuid, text) TO service_role;

-- Mark the precise point where a private document is about to leave our
-- infrastructure. A reservation may be released only before this succeeds.
CREATE OR REPLACE FUNCTION public.mark_payslip_provider_started(
  p_payslip_id uuid,
  p_user_id uuid,
  p_processing_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_payslip_id IS NULL OR p_user_id IS NULL OR p_processing_token IS NULL THEN
    RAISE EXCEPTION 'A payslip, user, and processing token are required';
  END IF;

  UPDATE public.payslips
  SET provider_started_at = now()
  WHERE id = p_payslip_id
    AND user_id = p_user_id
    AND status = 'processing'
    AND processing_token = p_processing_token;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.payslip_check_reservations
  SET provider_started_at = coalesce(provider_started_at, now())
  WHERE user_id = p_user_id
    AND payslip_id = p_payslip_id
    AND provider_started_at IS NULL;

  -- Paid checks have no free reservation, but a current fenced claim is still
  -- safe to send to the provider.
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_payslip_provider_started(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_payslip_provider_started(uuid, uuid, uuid) TO service_role;

-- Failure writes are fenced to the claim token. A stale worker cannot change
-- a reclaimed or reviewed payslip, and local validation failures atomically
-- release only a never-dispatched free reservation.
CREATE OR REPLACE FUNCTION public.fail_payslip_processing(
  p_payslip_id uuid,
  p_user_id uuid,
  p_processing_token uuid,
  p_failure_code text,
  p_release_unstarted_reservation boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_failed boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_payslip_id IS NULL OR p_user_id IS NULL OR p_processing_token IS NULL
    OR length(trim(coalesce(p_failure_code, ''))) = 0 OR length(p_failure_code) > 120 THEN
    RAISE EXCEPTION 'Invalid processing failure input';
  END IF;

  UPDATE public.payslips
  SET
    status = 'failed',
    processing_finished_at = now(),
    processing_failure_code = p_failure_code,
    processing_token = null
  WHERE id = p_payslip_id
    AND user_id = p_user_id
    AND status = 'processing'
    AND processing_token = p_processing_token
  RETURNING true INTO v_failed;

  IF NOT coalesce(v_failed, false) THEN
    RETURN false;
  END IF;

  UPDATE public.payslip_extractions
  SET
    extraction_status = 'failed',
    raw_extraction_json = null,
    processing_token = null
  WHERE payslip_id = p_payslip_id
    AND processing_token = p_processing_token;

  IF p_release_unstarted_reservation THEN
    DELETE FROM public.payslip_check_reservations
    WHERE user_id = p_user_id
      AND payslip_id = p_payslip_id
      AND provider_started_at IS NULL;
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.fail_payslip_processing(uuid, uuid, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_payslip_processing(uuid, uuid, uuid, text, boolean) TO service_role;

-- Keep the fencing token server-owned even if a future migration restores a
-- broad browser update policy on payslips.
CREATE OR REPLACE FUNCTION public.enforce_client_payslip_processing_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.processing_token IS NOT NULL THEN
    RAISE EXCEPTION 'Only the processing service may create a processing token';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.processing_token IS DISTINCT FROM OLD.processing_token THEN
    RAISE EXCEPTION 'Only the processing service may change a processing token';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.provider_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only the processing service may record a provider dispatch';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.provider_started_at IS DISTINCT FROM OLD.provider_started_at THEN
    RAISE EXCEPTION 'Only the processing service may change a provider dispatch';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_client_payslip_processing_token ON public.payslips;
CREATE TRIGGER enforce_client_payslip_processing_token
  BEFORE INSERT OR UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_payslip_processing_token();

-- The processing function now has one authorised claim path that combines the
-- quota reservation with the processing lock. Keep the old RPC unavailable so
-- a future server call cannot accidentally skip the free-check quota.
REVOKE EXECUTE ON FUNCTION public.claim_payslip_processing(uuid, uuid) FROM service_role;
