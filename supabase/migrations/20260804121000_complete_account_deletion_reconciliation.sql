-- Close the remaining lifecycle gaps around short-lived original links,
-- stalled provider work, and payment events that race account deletion.

CREATE TABLE IF NOT EXISTS public.payslip_original_link_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payslip_id uuid NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  object_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS payslip_original_link_leases_user_expiry_idx
  ON public.payslip_original_link_leases (user_id, expires_at);

ALTER TABLE public.payslip_original_link_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payslip_original_link_leases FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payslip_original_link_leases TO service_role;

-- Reserve a bounded read lease before minting a bearer URL. The URL itself is
-- created by Storage outside Postgres, so this record is the durable fence:
-- issuance that wins is waited out by deletion; deletion that wins rejects a
-- new read link before it can be minted.
CREATE OR REPLACE FUNCTION public.reserve_secure_payslip_original_link_lease(
  p_user_id uuid,
  p_payslip_id uuid,
  p_object_path text,
  p_lease_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_lifecycle_state text;
  v_session_state text;
  v_object_path text;
  v_expires_at timestamptz;
  v_lease_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL OR p_payslip_id IS NULL
    OR length(trim(coalesce(p_object_path, ''))) = 0
    OR p_lease_seconds IS NULL OR p_lease_seconds < 60 OR p_lease_seconds > 120 THEN
    RAISE EXCEPTION 'Invalid original-link lease';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );

  SELECT lifecycle.state INTO v_lifecycle_state
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = p_user_id
  FOR KEY SHARE;
  IF FOUND AND v_lifecycle_state <> 'active' THEN
    RETURN jsonb_build_object('status', 'account_deletion_pending');
  END IF;

  -- Keep the session -> payslip order used by secure upload cleanup paths.
  SELECT session.state INTO v_session_state
  FROM public.payslip_upload_sessions AS session
  WHERE session.payslip_id = p_payslip_id
    AND session.user_id = p_user_id
  FOR KEY SHARE;
  IF FOUND AND v_session_state = 'cleanup_pending' THEN
    RETURN jsonb_build_object('status', 'cleanup_pending');
  END IF;

  SELECT payslip.file_path INTO v_object_path
  FROM public.payslips AS payslip
  WHERE payslip.id = p_payslip_id
    AND payslip.user_id = p_user_id
  FOR KEY SHARE;
  IF NOT FOUND OR v_object_path IS DISTINCT FROM p_object_path THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  DELETE FROM public.payslip_original_link_leases AS lease
  WHERE lease.user_id = p_user_id
    AND lease.expires_at <= now();

  v_expires_at := now() + make_interval(secs => p_lease_seconds);
  INSERT INTO public.payslip_original_link_leases (
    user_id,
    payslip_id,
    object_path,
    expires_at
  )
  VALUES (
    p_user_id,
    p_payslip_id,
    p_object_path,
    v_expires_at
  )
  RETURNING id INTO v_lease_id;

  RETURN jsonb_build_object(
    'status', 'issued',
    'lease_id', v_lease_id,
    'expires_at', v_expires_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_secure_payslip_original_link_lease(uuid, uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_secure_payslip_original_link_lease(uuid, uuid, text, integer) TO service_role;

-- A signed Storage URL cannot be minted inside the database transaction. Keep
-- its initial reservation private, then activate/extend the exact lease only
-- after Storage has returned a URL and immediately before that URL is sent to
-- the user. If deletion wins before this second fence, the Edge Function
-- discards the undisclosed URL instead of returning it.
CREATE OR REPLACE FUNCTION public.activate_secure_payslip_original_link_lease(
  p_lease_id uuid,
  p_user_id uuid,
  p_payslip_id uuid,
  p_object_path text,
  p_lease_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_lifecycle_state text;
  v_lease public.payslip_original_link_leases%ROWTYPE;
  v_expires_at timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_lease_id IS NULL OR p_user_id IS NULL OR p_payslip_id IS NULL
    OR length(trim(coalesce(p_object_path, ''))) = 0
    OR p_lease_seconds IS NULL OR p_lease_seconds < 60 OR p_lease_seconds > 120 THEN
    RAISE EXCEPTION 'Invalid original-link lease activation';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );

  SELECT lifecycle.state INTO v_lifecycle_state
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = p_user_id
  FOR KEY SHARE;
  IF FOUND AND v_lifecycle_state <> 'active' THEN
    RETURN jsonb_build_object('status', 'account_deletion_pending');
  END IF;

  SELECT * INTO v_lease
  FROM public.payslip_original_link_leases AS lease
  WHERE lease.id = p_lease_id
    AND lease.user_id = p_user_id
    AND lease.payslip_id = p_payslip_id
    AND lease.object_path = p_object_path
  FOR UPDATE;
  IF NOT FOUND OR v_lease.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'lease_expired');
  END IF;

  v_expires_at := now() + make_interval(secs => p_lease_seconds);
  UPDATE public.payslip_original_link_leases
  SET expires_at = v_expires_at
  WHERE id = v_lease.id;

  RETURN jsonb_build_object('status', 'issued', 'expires_at', v_expires_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_secure_payslip_original_link_lease(uuid, uuid, uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_secure_payslip_original_link_lease(uuid, uuid, uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.prune_expired_payslip_original_link_leases(
  p_limit integer DEFAULT 1000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'Invalid original-link lease cleanup limit';
  END IF;

  WITH expired AS (
    SELECT lease.id
    FROM public.payslip_original_link_leases AS lease
    WHERE lease.expires_at <= now()
    ORDER BY lease.expires_at ASC, lease.id ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.payslip_original_link_leases AS lease
  USING expired
  WHERE lease.id = expired.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_expired_payslip_original_link_leases(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_expired_payslip_original_link_leases(integer) TO service_role;

-- Once deletion has fenced new provider dispatches, a request already marked
-- processing needs a bounded drain. A current worker gets a full twenty-minute
-- grace period; a stale one is terminally failed without attempting another
-- provider call, then normal deletion may continue.
CREATE OR REPLACE FUNCTION public.drain_secure_account_deletion_processing(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_lifecycle_state text;
  v_payslip record;
  v_candidate_retry_at timestamptz;
  v_retry_at timestamptz := NULL;
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
  SELECT lifecycle.state INTO v_lifecycle_state
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_lifecycle_state <> 'deleting' THEN
    RETURN jsonb_build_object('status', 'not_deleting');
  END IF;

  FOR v_payslip IN
    SELECT
      payslip.id,
      payslip.created_at,
      payslip.processing_started_at,
      payslip.provider_started_at,
      payslip.processing_token
    FROM public.payslips AS payslip
    WHERE payslip.user_id = p_user_id
      AND payslip.status = 'processing'
    ORDER BY payslip.id ASC
    FOR UPDATE
  LOOP
    v_candidate_retry_at := coalesce(v_payslip.processing_started_at, v_payslip.created_at)
      + interval '20 minutes';
    IF v_candidate_retry_at > now() THEN
      IF v_retry_at IS NULL OR v_candidate_retry_at < v_retry_at THEN
        v_retry_at := v_candidate_retry_at;
      END IF;
      CONTINUE;
    END IF;

    UPDATE public.payslips
    SET
      status = 'failed',
      processing_finished_at = now(),
      processing_failure_code = CASE
        WHEN v_payslip.provider_started_at IS NULL THEN 'deletion_stalled_before_dispatch'
        ELSE 'deletion_stalled_after_dispatch'
      END,
      processing_token = NULL
    WHERE id = v_payslip.id
      AND user_id = p_user_id
      AND status = 'processing'
      AND processing_token IS NOT DISTINCT FROM v_payslip.processing_token;

    UPDATE public.payslip_extractions
    SET
      extraction_status = 'failed',
      raw_extraction_json = NULL,
      processing_token = NULL
    WHERE payslip_id = v_payslip.id
      AND processing_token IS NOT DISTINCT FROM v_payslip.processing_token;
  END LOOP;

  IF v_retry_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'pending', 'retry_at', v_retry_at);
  END IF;
  RETURN jsonb_build_object('status', 'cleared');
END;
$function$;

REVOKE ALL ON FUNCTION public.drain_secure_account_deletion_processing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.drain_secure_account_deletion_processing(uuid) TO service_role;

-- Renew immediately before every irreversible deletion phase. This does not
-- make external systems transactional, but it prevents a worker whose lease
-- was already reclaimed from beginning a fresh Stripe, Storage, or Auth step.
CREATE OR REPLACE FUNCTION public.renew_account_deletion_job_lease(
  p_job_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_job_id IS NULL OR p_lease_token IS NULL
    OR p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION 'Invalid account deletion lease renewal';
  END IF;

  SELECT job.user_id INTO v_user_id
  FROM public.account_deletion_jobs AS job
  WHERE job.id = p_job_id;
  IF NOT FOUND OR v_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || v_user_id::text)::bigint
  );
  PERFORM 1
  FROM public.account_lifecycle AS lifecycle
  WHERE lifecycle.user_id = v_user_id
    AND lifecycle.state = 'deleting'
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.account_deletion_jobs
  SET
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    updated_at = now()
  WHERE id = p_job_id
    AND user_id = v_user_id
    AND state = 'running'
    AND lease_token = p_lease_token
    AND lease_expires_at > now();

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.renew_account_deletion_job_lease(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_account_deletion_job_lease(uuid, uuid, integer) TO service_role;

-- Payment webhooks use these lifecycle-gated wrappers. A completed payment
-- after deletion begins is preserved as a review/reconciliation case rather
-- than granted then cascaded away with the account.
CREATE OR REPLACE FUNCTION public.record_secure_lifetime_payment_intent(
  p_intent_id uuid,
  p_user_id uuid,
  p_environment text,
  p_session_id text,
  p_payment_intent_id text
)
RETURNS text
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
    WHERE lifecycle.user_id = p_user_id
      AND lifecycle.state <> 'active'
  ) THEN
    RETURN 'account_deletion_pending';
  END IF;

  RETURN public.record_lifetime_payment_intent(
    p_intent_id,
    p_user_id,
    p_environment,
    p_session_id,
    p_payment_intent_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_secure_lifetime_payment_intent(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_secure_lifetime_payment_intent(uuid, uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_secure_lifetime_entitlement(
  p_intent_id uuid,
  p_user_id uuid,
  p_environment text,
  p_session_id text,
  p_customer_id text,
  p_product_id text,
  p_price_id text
)
RETURNS text
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
    WHERE lifecycle.user_id = p_user_id
      AND lifecycle.state <> 'active'
  ) THEN
    RETURN 'account_deletion_pending';
  END IF;

  RETURN public.grant_lifetime_entitlement(
    p_intent_id,
    p_user_id,
    p_environment,
    p_session_id,
    p_customer_id,
    p_product_id,
    p_price_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_secure_lifetime_entitlement(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_secure_lifetime_entitlement(uuid, uuid, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_secure_stripe_subscription(
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_product_id text,
  p_price_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_environment text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_user_id IS NULL
    OR p_environment NOT IN ('sandbox', 'live')
    OR length(trim(coalesce(p_stripe_subscription_id, ''))) = 0
    OR length(trim(coalesce(p_stripe_customer_id, ''))) = 0
    OR length(trim(coalesce(p_product_id, ''))) = 0
    OR length(trim(coalesce(p_price_id, ''))) = 0
    OR length(trim(coalesce(p_status, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid Stripe subscription entitlement';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('account-lifecycle:' || p_user_id::text)::bigint
  );
  IF EXISTS (
    SELECT 1 FROM public.account_lifecycle AS lifecycle
    WHERE lifecycle.user_id = p_user_id
      AND lifecycle.state <> 'active'
  ) THEN
    RETURN 'account_deletion_pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN 'user_missing';
  END IF;

  INSERT INTO public.subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    product_id,
    price_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    environment,
    updated_at
  )
  VALUES (
    p_user_id,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    p_product_id,
    p_price_id,
    p_status,
    p_current_period_start,
    p_current_period_end,
    coalesce(p_cancel_at_period_end, false),
    p_environment,
    now()
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE
  SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    product_id = EXCLUDED.product_id,
    price_id = EXCLUDED.price_id,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    environment = EXCLUDED.environment,
    updated_at = EXCLUDED.updated_at;

  RETURN 'upserted';
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_secure_stripe_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_secure_stripe_subscription(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text) TO service_role;
