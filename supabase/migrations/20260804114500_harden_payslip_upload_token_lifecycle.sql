-- Upgrade path for any environment that applied the first upload-session
-- migration before its token-lifecycle hardening landed. Keep this migration
-- even though 20260804114000 now contains the same end state: Supabase records
-- migrations by timestamp and will never replay an older applied file.

ALTER TABLE public.payslip_upload_sessions
  DROP CONSTRAINT IF EXISTS payslip_upload_sessions_state_check;

ALTER TABLE public.payslip_upload_sessions
  ADD CONSTRAINT payslip_upload_sessions_state_check
  CHECK (state IN ('issued', 'finalized', 'cleanup_pending', 'expired', 'cancelled'));

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS cleanup_requested_at timestamptz;

ALTER TABLE public.payslips
  DROP CONSTRAINT IF EXISTS payslips_cleanup_requested_must_remain_failed;

ALTER TABLE public.payslips
  ADD CONSTRAINT payslips_cleanup_requested_must_remain_failed
  CHECK (cleanup_requested_at IS NULL OR status = 'failed');

DROP INDEX IF EXISTS public.payslip_upload_sessions_expiry_idx;

CREATE INDEX payslip_upload_sessions_expiry_idx
  ON public.payslip_upload_sessions (expires_at)
  WHERE state IN ('issued', 'cleanup_pending');

-- Older session issuance used a different advisory-lock key from the existing
-- processing claim. Wrap it with the legacy key so staged old/new clients
-- cannot exceed the same monthly allowance concurrently.
CREATE OR REPLACE FUNCTION public.begin_secure_payslip_upload_session(
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
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':' || v_period::text)::bigint
  );

  RETURN public.begin_payslip_upload_session(
    p_user_id,
    p_environment,
    p_display_file_name
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.begin_secure_payslip_upload_session(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_secure_payslip_upload_session(uuid, text, text) TO service_role;

-- Only the server may remove an object once its non-revocable signed token
-- has expired. These names are deliberately new so they override the original
-- flow even on databases that had already applied the older migration.
CREATE OR REPLACE FUNCTION public.list_expired_secure_payslip_upload_sessions(
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(session_id uuid, user_id uuid, object_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'Invalid cleanup limit';
  END IF;

  RETURN QUERY
  SELECT session.id, session.user_id, session.object_path
  FROM public.payslip_upload_sessions AS session
  WHERE session.state IN ('issued', 'cleanup_pending')
    AND session.expires_at <= now()
    AND (p_user_id IS NULL OR session.user_id = p_user_id)
  ORDER BY session.expires_at ASC, session.id ASC
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_expired_secure_payslip_upload_sessions(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_expired_secure_payslip_upload_sessions(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_expired_secure_payslip_upload_session(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_session public.payslip_upload_sessions%ROWTYPE;
  v_payslip public.payslips%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT session.* INTO v_session
  FROM public.payslip_upload_sessions AS session
  WHERE session.id = p_session_id
    AND session.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_session.state NOT IN ('issued', 'cleanup_pending') OR v_session.expires_at > now() THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM storage.objects AS object
    WHERE object.bucket_id = 'payslips'
      AND object.name = v_session.object_path
  ) THEN
    RETURN false;
  END IF;

  IF v_session.state = 'issued' THEN
    UPDATE public.payslip_upload_sessions
    SET state = 'expired', ended_at = now()
    WHERE id = p_session_id
      AND user_id = p_user_id
      AND state = 'issued';

    DELETE FROM public.payslip_check_reservations
    WHERE user_id = p_user_id
      AND upload_session_id = p_session_id
      AND payslip_id IS NULL
      AND provider_started_at IS NULL;

    RETURN true;
  END IF;

  IF v_session.payslip_id IS NULL THEN
    UPDATE public.payslip_upload_sessions
    SET state = 'cancelled', ended_at = now()
    WHERE id = p_session_id
      AND user_id = p_user_id
      AND state = 'cleanup_pending';

    DELETE FROM public.payslip_check_reservations
    WHERE user_id = p_user_id
      AND upload_session_id = p_session_id
      AND payslip_id IS NULL
      AND provider_started_at IS NULL;

    RETURN true;
  END IF;

  SELECT payslip.* INTO v_payslip
  FROM public.payslips AS payslip
  WHERE payslip.id = v_session.payslip_id
    AND payslip.user_id = p_user_id
    AND payslip.status = 'failed'
    AND payslip.cleanup_requested_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  DELETE FROM public.payslip_check_reservations
  WHERE user_id = p_user_id
    AND payslip_id = v_payslip.id
    AND provider_started_at IS NULL;

  DELETE FROM public.payslips
  WHERE id = v_payslip.id
    AND user_id = p_user_id
    AND status = 'failed'
    AND cleanup_requested_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed payslip cleanup changed during expiry';
  END IF;

  DELETE FROM public.payslip_upload_sessions
  WHERE id = p_session_id
    AND user_id = p_user_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.settle_expired_secure_payslip_upload_session(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_expired_secure_payslip_upload_session(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.request_payslip_upload_session_cleanup(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_session public.payslip_upload_sessions%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT session.* INTO v_session
  FROM public.payslip_upload_sessions AS session
  WHERE session.id = p_session_id
    AND session.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_session.state = 'cleanup_pending' THEN
    RETURN jsonb_build_object('status', 'pending', 'expires_at', v_session.expires_at);
  END IF;
  IF v_session.state <> 'issued' THEN
    RETURN jsonb_build_object('status', v_session.state);
  END IF;

  UPDATE public.payslip_upload_sessions
  SET state = 'cleanup_pending'
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND state = 'issued';

  RETURN jsonb_build_object('status', 'pending', 'expires_at', v_session.expires_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_payslip_upload_session_cleanup(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_payslip_upload_session_cleanup(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.request_failed_payslip_cleanup(
  p_payslip_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payslip public.payslips%ROWTYPE;
  v_session public.payslip_upload_sessions%ROWTYPE;
  v_has_session boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_payslip_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'A payslip and user are required';
  END IF;

  -- Use the same session-then-payslip order as the expiry worker and finalizer
  -- so a retry, cleanup request, and expiry settlement cannot deadlock.
  SELECT session.* INTO v_session
  FROM public.payslip_upload_sessions AS session
  WHERE session.payslip_id = p_payslip_id
    AND session.user_id = p_user_id
  FOR UPDATE;
  v_has_session := FOUND;

  SELECT payslip.* INTO v_payslip
  FROM public.payslips AS payslip
  WHERE payslip.id = p_payslip_id
    AND payslip.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_payslip.status <> 'failed' THEN
    RETURN jsonb_build_object('status', 'not_removable');
  END IF;

  IF v_has_session THEN
    IF v_session.state NOT IN ('finalized', 'cleanup_pending')
      OR v_session.object_path IS DISTINCT FROM v_payslip.file_path THEN
      RETURN jsonb_build_object('status', 'needs_review');
    END IF;
  END IF;

  UPDATE public.payslips
  SET cleanup_requested_at = COALESCE(cleanup_requested_at, now())
  WHERE id = p_payslip_id
    AND user_id = p_user_id
    AND status = 'failed';

  IF v_has_session THEN
    UPDATE public.payslip_upload_sessions
    SET state = 'cleanup_pending'
    WHERE id = v_session.id
      AND user_id = p_user_id
      AND state = 'finalized';

    IF v_session.expires_at > now() THEN
      RETURN jsonb_build_object('status', 'waiting_for_token_expiry', 'expires_at', v_session.expires_at);
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'ready', 'object_path', v_payslip.file_path);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_failed_payslip_cleanup(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_failed_payslip_cleanup(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_failed_payslip_after_storage_cleanup(
  p_payslip_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_payslip public.payslips%ROWTYPE;
  v_session public.payslip_upload_sessions%ROWTYPE;
  v_has_session boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  -- Lock session before payslip, matching all other two-row lifecycle paths.
  SELECT session.* INTO v_session
  FROM public.payslip_upload_sessions AS session
  WHERE session.payslip_id = p_payslip_id
    AND session.user_id = p_user_id
  FOR UPDATE;
  v_has_session := FOUND;

  SELECT payslip.* INTO v_payslip
  FROM public.payslips AS payslip
  WHERE payslip.id = p_payslip_id
    AND payslip.user_id = p_user_id
    AND payslip.status = 'failed'
    AND payslip.cleanup_requested_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_has_session THEN
    -- Do not let any service-side caller remove the tracking row while the
    -- bearer upload token remains usable. The normal Edge path reaches this
    -- only after the request RPC has made the same decision.
    IF v_session.state <> 'cleanup_pending'
      OR v_session.object_path IS DISTINCT FROM v_payslip.file_path THEN
      RETURN jsonb_build_object('status', 'needs_review');
    END IF;
    IF v_session.expires_at > now() THEN
      RETURN jsonb_build_object(
        'status', 'token_active',
        'expires_at', v_session.expires_at
      );
    END IF;
  END IF;
  IF v_payslip.file_path IS NOT NULL AND EXISTS (
    SELECT 1
    FROM storage.objects AS object
    WHERE object.bucket_id = 'payslips'
      AND object.name = v_payslip.file_path
  ) THEN
    RETURN jsonb_build_object('status', 'object_present');
  END IF;

  DELETE FROM public.payslip_check_reservations
  WHERE user_id = p_user_id
    AND payslip_id = p_payslip_id
    AND provider_started_at IS NULL;

  DELETE FROM public.payslip_upload_sessions
  WHERE user_id = p_user_id
    AND payslip_id = p_payslip_id
    AND state = 'cleanup_pending'
    AND expires_at <= now();

  DELETE FROM public.payslips
  WHERE id = p_payslip_id
    AND user_id = p_user_id
    AND status = 'failed'
    AND cleanup_requested_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object('status', 'deleted');
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_failed_payslip_after_storage_cleanup(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_failed_payslip_after_storage_cleanup(uuid, uuid) TO service_role;

-- Re-define the dispatch claim so already-applied older migrations cannot
-- turn a pre-reserved paid upload into an entitlement grace period. The quota
-- period is the provider-dispatch month, not the month in which a bearer
-- upload token happened to be issued.
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':' || v_period::text)::bigint
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

  v_monthly_limit := CASE WHEN v_tier IN ('plus', 'lifetime') THEN 6 ELSE 3 END;

  SELECT reservation.id, reservation.period INTO v_reservation_id, v_reservation_period
  FROM public.payslip_check_reservations AS reservation
  WHERE reservation.payslip_id = p_payslip_id
  FOR UPDATE;

  SELECT count(*)::integer INTO v_reservations_this_month
  FROM public.payslip_check_reservations AS reservation
  WHERE reservation.user_id = p_user_id
    AND reservation.period = v_period;

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

-- The old helper could mark a session cancelled after an object was removed,
-- which is unsafe while its bearer upload token remains valid. New clients
-- never call it; removing the grant prevents accidental server-side reuse.
DO $block$
BEGIN
  IF to_regprocedure('public.cancel_payslip_upload_session(uuid,uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.cancel_payslip_upload_session(uuid, uuid) FROM PUBLIC;
  END IF;
END;
$block$;
