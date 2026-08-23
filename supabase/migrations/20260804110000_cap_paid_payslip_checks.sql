-- Paid automatic checks must remain bounded by the same server-owned ledger
-- as the Free allowance. This is a launch cap, not a client-side hint: every
-- provider dispatch first receives a durable reservation in this table.
--
-- Keep the tier at the time of reservation for support and cost analysis. A
-- later cancellation, upgrade, or refund must not rewrite the history of a
-- provider request that has already started.
ALTER TABLE public.payslip_check_reservations
  ADD COLUMN IF NOT EXISTS tier_at_reservation text NOT NULL DEFAULT 'free';

ALTER TABLE public.payslip_check_reservations
  DROP CONSTRAINT IF EXISTS payslip_check_reservations_tier_at_reservation_check;

ALTER TABLE public.payslip_check_reservations
  ADD CONSTRAINT payslip_check_reservations_tier_at_reservation_check
  CHECK (tier_at_reservation IN ('free', 'plus', 'lifetime'));

COMMENT ON COLUMN public.payslip_check_reservations.tier_at_reservation IS
  'Server-derived entitlement tier at the time this automatic payslip check was reserved.';

-- The claimed row cannot be refunded after provider dispatch: it is the cost
-- ledger. A never-dispatched validation failure remains releasable through
-- fail_payslip_processing, regardless of the tier.
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
  v_tier text := 'free';
  v_monthly_limit integer := 3;
  v_reservation_id uuid;
  v_reservation_period date;
  v_reservations_this_month integer := 0;
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

  -- Serialise every automatic-check reservation for this account and Ireland
  -- calendar month. This prevents concurrent browser tabs from each seeing a
  -- remaining paid or free slot.
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

  -- Determine the tier only from the configured billing environment and
  -- current server-side subscriptions. Browser data never selects a tier.
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.subscriptions AS s
      WHERE s.user_id = p_user_id
        AND s.environment = p_environment
        AND (s.price_id IN ('lifetime_once', 'lifetime_once_gbp')
          OR s.product_id IN ('lifetime', 'lifetime_plan'))
        AND s.status = 'active'
    ) THEN 'lifetime'
    WHEN EXISTS (
      SELECT 1
      FROM public.subscriptions AS s
      WHERE s.user_id = p_user_id
        AND s.environment = p_environment
        AND s.price_id IN ('plus_yearly', 'plus_monthly', 'plus_yearly_gbp', 'plus_monthly_gbp')
        AND s.status IN ('active', 'trialing', 'canceled')
        AND s.current_period_end > now()
    ) THEN 'plus'
    ELSE 'free'
  END INTO v_tier;

  -- Deliberate launch ceiling: six paid automatic checks per Ireland calendar
  -- month. Revisit this only after production provider-cost telemetry and an
  -- explicit pricing decision; do not silently turn it into "unlimited".
  v_monthly_limit := CASE WHEN v_tier IN ('plus', 'lifetime') THEN 6 ELSE 3 END;

  -- A retry of the same payslip reuses the first reservation and never takes a
  -- second slot. A pre-reserved signed-upload session is a storage/quota hold,
  -- not a two-hour paid-entitlement grace: current server-side entitlement is
  -- checked again immediately before a private document can reach a provider.
  SELECT r.id, r.period INTO v_reservation_id, v_reservation_period
  FROM public.payslip_check_reservations AS r
  WHERE r.payslip_id = p_payslip_id
  FOR UPDATE;

  SELECT count(*)::integer INTO v_reservations_this_month
  FROM public.payslip_check_reservations AS r
  WHERE r.user_id = p_user_id
    AND r.period = v_period;

  -- A new record must fit before it is inserted. A pre-reserved record from a
  -- prior calendar month is moved into the month in which it is actually
  -- dispatched; otherwise a user could stockpile paid upload tokens before a
  -- cancellation/refund and send them after entitlement has ended. A record
  -- already in this month is included in the count, so it uses `>` instead.
  IF (v_reservation_id IS NULL AND v_reservations_this_month >= v_monthly_limit)
    OR (v_reservation_id IS NOT NULL AND v_reservation_period IS DISTINCT FROM v_period AND v_reservations_this_month >= v_monthly_limit)
    OR (v_reservation_id IS NOT NULL AND v_reservation_period = v_period AND v_reservations_this_month > v_monthly_limit) THEN
    UPDATE public.payslips
    SET
      status = 'failed',
      processing_finished_at = now(),
      processing_failure_code = 'monthly_upload_limit',
      processing_token = null
    WHERE id = p_payslip_id
      AND user_id = p_user_id
      AND status = 'processing';
    RETURN jsonb_build_object(
      'status', 'quota_exceeded',
      'tier', v_tier,
      'monthly_limit', v_monthly_limit
    );
  END IF;

  IF v_reservation_id IS NULL THEN
    INSERT INTO public.payslip_check_reservations (user_id, payslip_id, period, tier_at_reservation)
    VALUES (p_user_id, p_payslip_id, v_period, v_tier);
  ELSIF v_reservation_period IS DISTINCT FROM v_period THEN
    UPDATE public.payslip_check_reservations
    SET period = v_period
    WHERE id = v_reservation_id
      AND user_id = p_user_id
      AND payslip_id = p_payslip_id
      AND period = v_reservation_period;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'conflict');
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
    'processing_token', v_processing_token::text,
    'tier', v_tier,
    'monthly_limit', v_monthly_limit
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_and_claim_payslip_processing(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_and_claim_payslip_processing(uuid, uuid, text) TO service_role;
