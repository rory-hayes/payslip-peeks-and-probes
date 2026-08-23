-- Account deletion crosses Stripe, Storage, the extraction provider, and
-- Supabase Auth. A durable lifecycle fence is required before any of those
-- external calls: otherwise a new bearer upload URL or Checkout Session can be
-- created after deletion has inspected the account but before Auth is removed.

CREATE TABLE IF NOT EXISTS public.account_lifecycle (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'deleting', 'manual_review')),
  generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0),
  deletion_request_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Keep the original account identifier through Auth's ON DELETE SET NULL so
  -- an unfinished receipt is recoverable rather than being mistaken for a
  -- successful deletion. This field is deliberately subject to the documented
  -- receipt retention/anonymisation policy.
  subject_user_id uuid NOT NULL,
  lifecycle_generation bigint NOT NULL CHECK (lifecycle_generation > 0),
  request_id uuid NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'running', 'manual_review', 'completed')),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  safe_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_jobs_one_open_user
  ON public.account_deletion_jobs (user_id)
  WHERE user_id IS NOT NULL AND state IN ('queued', 'running', 'manual_review');

CREATE INDEX IF NOT EXISTS account_deletion_jobs_due_idx
  ON public.account_deletion_jobs (next_attempt_at, created_at)
  WHERE state = 'queued' AND user_id IS NOT NULL;

ALTER TABLE public.account_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.account_lifecycle, public.account_deletion_jobs FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_lifecycle, public.account_deletion_jobs TO service_role;

-- A lifecycle row is deliberately created in the same transaction as its
-- durable job. New server-owned actions take this advisory lock before their
-- own quota or billing locks, so an operation that wins the race is visible to
-- the deletion job and an operation that loses cannot begin.
CREATE OR REPLACE FUNCTION public.begin_account_deletion_request(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_lifecycle public.account_lifecycle%ROWTYPE;
  v_job public.account_deletion_jobs%ROWTYPE;
  v_request_id uuid := gen_random_uuid();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('status', 'user_missing');
  END IF;

  INSERT INTO public.account_lifecycle (user_id, state, generation, deletion_request_id, updated_at)
  VALUES (p_user_id, 'deleting', 1, v_request_id, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    state = CASE
      WHEN public.account_lifecycle.state = 'active' THEN 'deleting'
      ELSE public.account_lifecycle.state
    END,
    generation = CASE
      WHEN public.account_lifecycle.state = 'active' THEN public.account_lifecycle.generation + 1
      ELSE public.account_lifecycle.generation
    END,
    deletion_request_id = CASE
      WHEN public.account_lifecycle.state = 'active' THEN EXCLUDED.deletion_request_id
      ELSE public.account_lifecycle.deletion_request_id
    END,
    updated_at = now()
  RETURNING * INTO v_lifecycle;

  SELECT * INTO v_job
  FROM public.account_deletion_jobs AS job
  WHERE job.user_id = p_user_id
    AND job.state IN ('queued', 'running', 'manual_review')
  ORDER BY job.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.account_deletion_jobs (
      user_id,
      subject_user_id,
      lifecycle_generation,
      request_id,
      state,
      next_attempt_at
    )
    VALUES (
      p_user_id,
      p_user_id,
      v_lifecycle.generation,
      v_lifecycle.deletion_request_id,
      'queued',
      now()
    )
    RETURNING * INTO v_job;
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_lifecycle.state = 'manual_review' THEN 'manual_review' ELSE 'queued' END,
    'job_id', v_job.id::text,
    'next_attempt_at', v_job.next_attempt_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.begin_account_deletion_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_account_deletion_request(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_account_deletion_job(
  p_job_id uuid,
  p_lease_seconds integer DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_job public.account_deletion_jobs%ROWTYPE;
  v_lease_token uuid := gen_random_uuid();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_job_id IS NULL OR p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'Invalid account deletion job claim';
  END IF;

  SELECT * INTO v_job
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_job.state = 'completed' THEN
    RETURN jsonb_build_object('status', 'completed');
  END IF;
  IF v_job.user_id IS NULL THEN
    -- An out-of-band Auth deletion can cascade the operational rows before the
    -- job confirms Storage and billing cleanup. Do not report that as success;
    -- preserve the immutable subject ID and require an operator to reconcile.
    UPDATE public.account_deletion_jobs
    SET
      state = 'manual_review',
      lease_token = NULL,
      lease_expires_at = NULL,
      safe_error_code = 'auth_deleted_recovery_needed',
      updated_at = now()
    WHERE id = p_job_id;
    RETURN jsonb_build_object('status', 'manual_review');
  END IF;
  IF v_job.state = 'manual_review' THEN
    RETURN jsonb_build_object('status', 'manual_review');
  END IF;
  IF v_job.state = 'running' AND v_job.lease_expires_at > now() THEN
    RETURN jsonb_build_object('status', 'leased', 'next_attempt_at', v_job.lease_expires_at);
  END IF;
  IF v_job.next_attempt_at > now() THEN
    RETURN jsonb_build_object('status', 'deferred', 'next_attempt_at', v_job.next_attempt_at);
  END IF;

  UPDATE public.account_deletion_jobs
  SET
    state = 'running',
    lease_token = v_lease_token,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    attempt_count = attempt_count + 1,
    safe_error_code = NULL,
    updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'job_id', v_job.id::text,
    'user_id', v_job.user_id::text,
    'lease_token', v_lease_token::text,
    'attempt_count', v_job.attempt_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_account_deletion_job(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion_job(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.reschedule_account_deletion_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_next_attempt_at timestamptz,
  p_safe_error_code text DEFAULT NULL,
  p_manual_review boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_updated boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_job_id IS NULL OR p_lease_token IS NULL OR p_next_attempt_at IS NULL
    OR (p_safe_error_code IS NOT NULL AND length(p_safe_error_code) > 120) THEN
    RAISE EXCEPTION 'Invalid account deletion job update';
  END IF;

  -- Match begin_account_deletion_request's order: lifecycle advisory lock,
  -- lifecycle row, then job row. Do not take the job row first and later
  -- update lifecycle, or a repeat delete can deadlock with a manual review.
  SELECT job.user_id INTO v_user_id
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_user_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('account-lifecycle:' || v_user_id::text)::bigint
    );
    PERFORM 1
    FROM public.account_lifecycle AS lifecycle
    WHERE lifecycle.user_id = v_user_id
    FOR UPDATE;
  END IF;

  UPDATE public.account_deletion_jobs
  SET
    state = CASE WHEN p_manual_review THEN 'manual_review' ELSE 'queued' END,
    next_attempt_at = CASE WHEN p_manual_review THEN now() ELSE p_next_attempt_at END,
    lease_token = NULL,
    lease_expires_at = NULL,
    safe_error_code = p_safe_error_code,
    updated_at = now()
  WHERE id = p_job_id
    AND state = 'running'
    AND lease_token = p_lease_token
  RETURNING user_id INTO v_user_id;
  v_updated := FOUND;

  IF v_updated AND p_manual_review AND v_user_id IS NOT NULL THEN
    UPDATE public.account_lifecycle
    SET state = 'manual_review', updated_at = now()
    WHERE user_id = v_user_id
      AND state = 'deleting';
  END IF;

  RETURN v_updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.reschedule_account_deletion_job(uuid, uuid, timestamptz, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_account_deletion_job(uuid, uuid, timestamptz, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_account_deletion_job(
  p_job_id uuid,
  p_lease_token uuid
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

  UPDATE public.account_deletion_jobs
  SET
    state = 'completed',
    lease_token = NULL,
    lease_expires_at = NULL,
    safe_error_code = NULL,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_job_id
    -- Auth deletion intentionally changes this non-cascading receipt's
    -- user_id to NULL. The worker must still own the active lease before it
    -- can seal a completed receipt, otherwise a concurrent manual-review
    -- transition (for example a late billing reconciliation) could be erased.
    AND state = 'running'
    AND lease_token = p_lease_token;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_account_deletion_job(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_account_deletion_job(uuid, uuid) TO service_role;

-- Read-only Edge endpoints call this before minting a new short-lived document
-- or billing link. The transaction lock keeps the decision aligned with all
-- server-owned writers, while a missing lifecycle row represents an active
-- account for backwards compatibility.
CREATE OR REPLACE FUNCTION public.is_account_lifecycle_active(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_state text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );

  SELECT lifecycle.state INTO v_state
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = p_user_id
  FOR KEY SHARE;

  RETURN NOT FOUND OR v_state = 'active';
END;
$function$;

REVOKE ALL ON FUNCTION public.is_account_lifecycle_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_lifecycle_active(uuid) TO service_role;

-- New server-owned actions use explicit secure wrappers. The legacy functions
-- remain for an in-flight staged rollout, but no current Edge Function calls
-- them directly after this migration.
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
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );
  IF EXISTS (
    SELECT 1 FROM public.account_lifecycle AS lifecycle
    WHERE lifecycle.user_id = p_user_id AND lifecycle.state <> 'active'
  ) THEN
    RETURN jsonb_build_object('status', 'account_deletion_pending');
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

CREATE OR REPLACE FUNCTION public.finalize_secure_payslip_upload_session(
  p_session_id uuid,
  p_user_id uuid,
  p_actual_bytes bigint,
  p_detected_mime_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );
  IF EXISTS (
    SELECT 1 FROM public.account_lifecycle AS lifecycle
    WHERE lifecycle.user_id = p_user_id AND lifecycle.state <> 'active'
  ) THEN
    RETURN jsonb_build_object('status', 'account_deletion_pending');
  END IF;

  RETURN public.finalize_payslip_upload_session(
    p_session_id,
    p_user_id,
    p_actual_bytes,
    p_detected_mime_type
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_secure_payslip_upload_session(uuid, uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_secure_payslip_upload_session(uuid, uuid, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_and_claim_secure_payslip_processing(
  p_payslip_id uuid,
  p_user_id uuid,
  p_environment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );
  IF EXISTS (
    SELECT 1 FROM public.account_lifecycle AS lifecycle
    WHERE lifecycle.user_id = p_user_id AND lifecycle.state <> 'active'
  ) THEN
    RETURN jsonb_build_object('status', 'account_deletion_pending');
  END IF;

  RETURN public.reserve_and_claim_payslip_processing(
    p_payslip_id,
    p_user_id,
    p_environment
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_and_claim_secure_payslip_processing(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_and_claim_secure_payslip_processing(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_secure_payslip_provider_started(
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
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );
  IF EXISTS (
    SELECT 1 FROM public.account_lifecycle AS lifecycle
    WHERE lifecycle.user_id = p_user_id AND lifecycle.state <> 'active'
  ) THEN
    RETURN false;
  END IF;

  RETURN public.mark_payslip_provider_started(
    p_payslip_id,
    p_user_id,
    p_processing_token
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_secure_payslip_provider_started(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_secure_payslip_provider_started(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_secure_checkout_intent(
  p_user_id uuid,
  p_environment text,
  p_price_lookup_key text,
  p_checkout_mode text,
  p_stripe_price_id text,
  p_customer_email text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  environment text,
  price_lookup_key text,
  checkout_mode text,
  stripe_price_id text,
  customer_email text,
  stripe_checkout_session_id text,
  state text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );
  IF EXISTS (
    SELECT 1 FROM public.account_lifecycle AS lifecycle
    WHERE lifecycle.user_id = p_user_id AND lifecycle.state <> 'active'
  ) THEN
    RETURN QUERY SELECT
      gen_random_uuid(),
      p_user_id,
      p_environment,
      p_price_lookup_key,
      p_checkout_mode,
      p_stripe_price_id,
      nullif(trim(p_customer_email), ''),
      NULL::text,
      'account_deletion_pending'::text,
      now();
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.acquire_checkout_intent(
    p_user_id,
    p_environment,
    p_price_lookup_key,
    p_checkout_mode,
    p_stripe_price_id,
    p_customer_email
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.acquire_secure_checkout_intent(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_secure_checkout_intent(uuid, text, text, text, text, text) TO service_role;
