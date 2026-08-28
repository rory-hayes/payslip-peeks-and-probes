-- The Free plan exists to prove the core comparison loop once: check a first
-- payslip, check a second, and see what changed. Renewing three automatic
-- checks every month lets a normal monthly-paid employee use the provider
-- indefinitely without ever reaching the paid continuation product.
--
-- Free therefore receives two automatic checks for the lifetime of the
-- account. Plus and Lifetime retain the deliberately bounded six-check
-- Europe/Dublin calendar-month allowance. The durable reservation ledger is
-- still authoritative and retries of a provider-started check never consume a
-- second slot.

CREATE INDEX IF NOT EXISTS payslip_check_reservations_user_free_tier_idx
  ON public.payslip_check_reservations (user_id, created_at)
  WHERE tier_at_reservation = 'free';

-- Reserve the correct allowance before issuing a non-revocable upload token.
CREATE OR REPLACE FUNCTION public.begin_payslip_upload_session(
  p_user_id uuid,
  p_environment text,
  p_display_file_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_period date := date_trunc('month', timezone('Europe/Dublin', now()))::date;
  v_tier text := 'free';
  v_quota_scope text := 'lifetime';
  v_quota_limit integer := 2;
  v_usage_count integer := 0;
  v_active_sessions integer := 0;
  v_expired_sessions integer := 0;
  v_session_id uuid := gen_random_uuid();
  v_object_path text;
  v_expires_at timestamptz := now() + interval '2 hours 5 minutes';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user is required';
  END IF;
  IF p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Invalid billing environment';
  END IF;
  IF p_display_file_name IS NULL
    OR length(p_display_file_name) < 1
    OR length(p_display_file_name) > 96
    OR p_display_file_name !~ '^[A-Za-z0-9][A-Za-z0-9._-]*$' THEN
    RAISE EXCEPTION 'Invalid payslip display name';
  END IF;

  -- A stable account-wide lock is required because Free usage spans month
  -- boundaries. The secure wrapper may also hold the legacy monthly lock;
  -- no code below acquires that lock in reverse order.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':automatic-check-quota')::bigint
  );

  -- Do not release a stale token's reservation until server cleanup proves
  -- that its exact private object no longer exists.
  SELECT count(*)::integer INTO v_expired_sessions
  FROM public.payslip_upload_sessions AS session
  WHERE session.user_id = p_user_id
    AND session.state = 'issued'
    AND session.expires_at <= now();

  IF v_expired_sessions > 0 THEN
    RETURN jsonb_build_object('status', 'cleanup_required');
  END IF;

  SELECT count(*)::integer INTO v_active_sessions
  FROM public.payslip_upload_sessions AS session
  WHERE session.user_id = p_user_id
    AND session.state = 'issued';

  IF v_active_sessions >= 2 THEN
    RETURN jsonb_build_object('status', 'active_upload_limit');
  END IF;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.subscriptions AS subscription
      WHERE subscription.user_id = p_user_id
        AND subscription.environment = p_environment
        AND (subscription.price_id IN ('lifetime_once', 'lifetime_once_gbp')
          OR subscription.product_id IN ('lifetime', 'lifetime_plan'))
        AND subscription.status = 'active'
    ) THEN 'lifetime'
    WHEN EXISTS (
      SELECT 1
      FROM public.subscriptions AS subscription
      WHERE subscription.user_id = p_user_id
        AND subscription.environment = p_environment
        AND subscription.price_id IN ('plus_yearly', 'plus_monthly', 'plus_yearly_gbp', 'plus_monthly_gbp')
        AND subscription.status IN ('active', 'trialing', 'canceled')
        AND subscription.current_period_end > now()
    ) THEN 'plus'
    ELSE 'free'
  END INTO v_tier;

  IF v_tier IN ('plus', 'lifetime') THEN
    v_quota_scope := 'month';
    v_quota_limit := 6;

    SELECT count(*)::integer INTO v_usage_count
    FROM public.payslip_check_reservations AS reservation
    WHERE reservation.user_id = p_user_id
      AND reservation.period = v_period;
  ELSE
    SELECT count(*)::integer INTO v_usage_count
    FROM public.payslip_check_reservations AS reservation
    WHERE reservation.user_id = p_user_id
      AND reservation.tier_at_reservation = 'free';
  END IF;

  IF v_usage_count >= v_quota_limit THEN
    RETURN jsonb_build_object(
      'status', 'quota_exceeded',
      'tier', v_tier,
      'quota_scope', v_quota_scope,
      'quota_limit', v_quota_limit
    );
  END IF;

  v_object_path := p_user_id::text || '/' || v_session_id::text || '.bin';

  INSERT INTO public.payslip_upload_sessions (
    id,
    user_id,
    object_path,
    display_file_name,
    state,
    expires_at
  )
  VALUES (
    v_session_id,
    p_user_id,
    v_object_path,
    p_display_file_name,
    'issued',
    v_expires_at
  );

  INSERT INTO public.payslip_check_reservations (
    user_id,
    upload_session_id,
    period,
    tier_at_reservation
  )
  VALUES (
    p_user_id,
    v_session_id,
    v_period,
    v_tier
  );

  RETURN jsonb_build_object(
    'status', 'issued',
    'session_id', v_session_id::text,
    'object_path', v_object_path,
    'expires_at', v_expires_at,
    'tier', v_tier,
    'quota_scope', v_quota_scope,
    'quota_limit', v_quota_limit
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.begin_payslip_upload_session(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_payslip_upload_session(uuid, text, text) TO service_role;

-- Re-check entitlement immediately before provider dispatch. A paid upload
-- token is not an entitlement grace period; an undispatched paid reservation
-- becomes a Free reservation if the subscription has ended. A retry whose
-- provider request already started reuses its original cost ledger entry.
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
  v_quota_scope text := 'lifetime';
  v_quota_limit integer := 2;
  v_usage_count integer := 0;
  v_reservation_id uuid;
  v_reservation_period date;
  v_reservation_tier text;
  v_reservation_provider_started_at timestamptz;
  v_existing_counts_toward_quota boolean := false;
  v_retry_already_charged boolean := false;
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':automatic-check-quota')::bigint
  );

  SELECT payslip.* INTO v_payslip
  FROM public.payslips AS payslip
  WHERE payslip.id = p_payslip_id
    AND payslip.user_id = p_user_id
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

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.subscriptions AS subscription
      WHERE subscription.user_id = p_user_id
        AND subscription.environment = p_environment
        AND (subscription.price_id IN ('lifetime_once', 'lifetime_once_gbp')
          OR subscription.product_id IN ('lifetime', 'lifetime_plan'))
        AND subscription.status = 'active'
    ) THEN 'lifetime'
    WHEN EXISTS (
      SELECT 1
      FROM public.subscriptions AS subscription
      WHERE subscription.user_id = p_user_id
        AND subscription.environment = p_environment
        AND subscription.price_id IN ('plus_yearly', 'plus_monthly', 'plus_yearly_gbp', 'plus_monthly_gbp')
        AND subscription.status IN ('active', 'trialing', 'canceled')
        AND subscription.current_period_end > now()
    ) THEN 'plus'
    ELSE 'free'
  END INTO v_tier;

  SELECT
    reservation.id,
    reservation.period,
    reservation.tier_at_reservation,
    reservation.provider_started_at
  INTO
    v_reservation_id,
    v_reservation_period,
    v_reservation_tier,
    v_reservation_provider_started_at
  FROM public.payslip_check_reservations AS reservation
  WHERE reservation.payslip_id = p_payslip_id
  FOR UPDATE;

  v_retry_already_charged := v_reservation_id IS NOT NULL
    AND v_reservation_provider_started_at IS NOT NULL;

  IF v_tier IN ('plus', 'lifetime') THEN
    v_quota_scope := 'month';
    v_quota_limit := 6;

    SELECT count(*)::integer INTO v_usage_count
    FROM public.payslip_check_reservations AS reservation
    WHERE reservation.user_id = p_user_id
      AND reservation.period = v_period;

    v_existing_counts_toward_quota := v_reservation_id IS NOT NULL
      AND v_reservation_period = v_period;
  ELSE
    SELECT count(*)::integer INTO v_usage_count
    FROM public.payslip_check_reservations AS reservation
    WHERE reservation.user_id = p_user_id
      AND reservation.tier_at_reservation = 'free';

    v_existing_counts_toward_quota := v_reservation_id IS NOT NULL
      AND v_reservation_tier = 'free';

  END IF;

  -- A completed provider dispatch already paid for this exact attempt. Its
  -- explicit retry reuses that ledger entry even if a later plan change or
  -- migration leaves the account above today's cap.
  IF NOT v_retry_already_charged AND (
    (v_existing_counts_toward_quota AND v_usage_count > v_quota_limit)
    OR (NOT v_existing_counts_toward_quota AND v_usage_count >= v_quota_limit)
  ) THEN
    UPDATE public.payslips
    SET
      status = 'failed',
      processing_finished_at = now(),
      processing_failure_code = 'automatic_check_limit',
      processing_token = null
    WHERE id = p_payslip_id
      AND user_id = p_user_id
      AND status = 'processing';
    RETURN jsonb_build_object(
      'status', 'quota_exceeded',
      'tier', v_tier,
      'quota_scope', v_quota_scope,
      'quota_limit', v_quota_limit
    );
  END IF;

  IF v_reservation_id IS NULL THEN
    INSERT INTO public.payslip_check_reservations (user_id, payslip_id, period, tier_at_reservation)
    VALUES (p_user_id, p_payslip_id, v_period, v_tier);
  ELSIF v_tier = 'free'
    AND v_reservation_tier <> 'free'
    AND v_reservation_provider_started_at IS NULL THEN
    UPDATE public.payslip_check_reservations
    SET
      period = v_period,
      tier_at_reservation = 'free'
    WHERE id = v_reservation_id
      AND user_id = p_user_id
      AND payslip_id = p_payslip_id
      AND provider_started_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;
  ELSIF v_tier IN ('plus', 'lifetime')
    AND v_reservation_period IS DISTINCT FROM v_period THEN
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
    'quota_scope', v_quota_scope,
    'quota_limit', v_quota_limit
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_and_claim_payslip_processing(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_and_claim_payslip_processing(uuid, uuid, text) TO service_role;
