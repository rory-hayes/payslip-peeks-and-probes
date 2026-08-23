-- Sensitive payslip originals are issued and finalised by Edge Functions. A
-- browser may receive one short-lived, object-scoped upload token, but it does
-- not choose a Storage key, create a payslip row, read arbitrary originals, or
-- remove objects directly.
--
-- This migration intentionally leaves the legacy browser policies in place for
-- a staged client rollout. Apply 20260804115000 only after the new web build
-- and the minimum supported mobile build use the server-owned flow.

CREATE TABLE IF NOT EXISTS public.payslip_upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_path text NOT NULL,
  display_file_name text NOT NULL,
  state text NOT NULL DEFAULT 'issued'
    CHECK (state IN ('issued', 'finalized', 'cleanup_pending', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  payslip_id uuid REFERENCES public.payslips(id) ON DELETE SET NULL,
  actual_bytes bigint,
  detected_mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT payslip_upload_sessions_expiry_after_creation
    CHECK (expires_at > created_at),
  CONSTRAINT payslip_upload_sessions_display_name_bounds
    CHECK (length(display_file_name) BETWEEN 1 AND 96),
  CONSTRAINT payslip_upload_sessions_object_path_owned
    CHECK (
      object_path LIKE (user_id::text || '/%')
      AND length(object_path) > length(user_id::text) + 1
      AND position('/' IN substr(object_path, length(user_id::text) + 2)) = 0
      AND position(chr(92) IN object_path) = 0
    ),
  CONSTRAINT payslip_upload_sessions_actual_bytes_bounds
    CHECK (actual_bytes IS NULL OR (actual_bytes > 0 AND actual_bytes <= 10485760)),
  CONSTRAINT payslip_upload_sessions_detected_mime_type_allowed
    CHECK (
      detected_mime_type IS NULL
      OR detected_mime_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS payslip_upload_sessions_object_path_key
  ON public.payslip_upload_sessions (object_path);

CREATE UNIQUE INDEX IF NOT EXISTS payslip_upload_sessions_payslip_id_key
  ON public.payslip_upload_sessions (payslip_id)
  WHERE payslip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payslip_upload_sessions_user_state_expiry_idx
  ON public.payslip_upload_sessions (user_id, state, expires_at);

DROP INDEX IF EXISTS public.payslip_upload_sessions_expiry_idx;

CREATE INDEX payslip_upload_sessions_expiry_idx
  ON public.payslip_upload_sessions (expires_at)
  WHERE state IN ('issued', 'cleanup_pending');

ALTER TABLE public.payslip_upload_sessions ENABLE ROW LEVEL SECURITY;

-- There are deliberately no browser RLS policies. Service-role Edge Functions
-- are the only callers that can enumerate sessions or see an object key.
DROP POLICY IF EXISTS "Users can view own payslip upload sessions" ON public.payslip_upload_sessions;
DROP POLICY IF EXISTS "Users can manage own payslip upload sessions" ON public.payslip_upload_sessions;

-- A deletion request claims a failed record before Storage is touched. The
-- check makes the claim a database-level fence: a concurrent retry cannot
-- turn a claimed failed payslip back into processing while its original is
-- waiting for the non-revocable signed-upload token to expire.
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS cleanup_requested_at timestamptz;

ALTER TABLE public.payslips
  DROP CONSTRAINT IF EXISTS payslips_cleanup_requested_must_remain_failed;

ALTER TABLE public.payslips
  ADD CONSTRAINT payslips_cleanup_requested_must_remain_failed
  CHECK (cleanup_requested_at IS NULL OR status = 'failed');

ALTER TABLE public.payslip_check_reservations
  ADD COLUMN IF NOT EXISTS upload_session_id uuid
    REFERENCES public.payslip_upload_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payslip_check_reservations_upload_session_id_key
  ON public.payslip_check_reservations (upload_session_id)
  WHERE upload_session_id IS NOT NULL;

-- Begin reserves a bounded monthly automatic-check slot before an object token
-- is issued. An unused session only releases that slot after the server has
-- confirmed its object has been removed after the two-hour token window.
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
  v_monthly_limit integer := 3;
  v_active_sessions integer := 0;
  v_reservations_this_month integer := 0;
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

  -- Use the exact existing automatic-check lock key while legacy direct
  -- uploads are still available during the staged rollout. That keeps a
  -- legacy process claim and a new upload-session reservation from both
  -- observing the same final monthly slot and exceeding the cap.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text || ':' || v_period::text)::bigint
  );

  -- Do not free a stale session's allowance until the Edge cleanup worker has
  -- removed its exact private object. This makes Storage retention fail closed.
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

  v_monthly_limit := CASE WHEN v_tier IN ('plus', 'lifetime') THEN 6 ELSE 3 END;

  SELECT count(*)::integer INTO v_reservations_this_month
  FROM public.payslip_check_reservations AS reservation
  WHERE reservation.user_id = p_user_id
    AND reservation.period = v_period;

  IF v_reservations_this_month >= v_monthly_limit THEN
    RETURN jsonb_build_object(
      'status', 'quota_exceeded',
      'tier', v_tier,
      'monthly_limit', v_monthly_limit
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
    'monthly_limit', v_monthly_limit
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.begin_payslip_upload_session(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_payslip_upload_session(uuid, text, text) TO service_role;

-- Finalisation is idempotent. The Edge Function supplies an actual byte count
-- and server-derived magic-byte MIME type after downloading exactly this
-- server-generated object path. The database then binds the pre-reserved
-- cost-control ledger to one immutable payslip row.
CREATE OR REPLACE FUNCTION public.finalize_payslip_upload_session(
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
DECLARE
  v_session public.payslip_upload_sessions%ROWTYPE;
  v_payslip_id uuid;
  v_reservation_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_session_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'A session and user are required';
  END IF;
  IF p_actual_bytes IS NULL OR p_actual_bytes < 1 OR p_actual_bytes > 10485760 THEN
    RAISE EXCEPTION 'Invalid payslip size';
  END IF;
  IF p_detected_mime_type NOT IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp') THEN
    RAISE EXCEPTION 'Invalid payslip content type';
  END IF;

  SELECT session.* INTO v_session
  FROM public.payslip_upload_sessions AS session
  WHERE session.id = p_session_id
    AND session.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_session.state = 'finalized' AND v_session.payslip_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'finalized', 'payslip_id', v_session.payslip_id::text);
  END IF;
  IF v_session.state <> 'issued' THEN
    RETURN jsonb_build_object('status', v_session.state);
  END IF;
  IF v_session.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  -- The Edge download establishes byte-level content validation. This check
  -- makes the row/object binding fail closed if the object disappeared between
  -- that validation and this transaction.
  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects AS object
    WHERE object.bucket_id = 'payslips'
      AND object.name = v_session.object_path
  ) THEN
    RETURN jsonb_build_object('status', 'missing_object');
  END IF;

  SELECT reservation.id INTO v_reservation_id
  FROM public.payslip_check_reservations AS reservation
  WHERE reservation.user_id = p_user_id
    AND reservation.upload_session_id = p_session_id
    AND reservation.payslip_id IS NULL
    AND reservation.provider_started_at IS NULL
  FOR UPDATE;

  IF v_reservation_id IS NULL THEN
    RETURN jsonb_build_object('status', 'reservation_unavailable');
  END IF;

  INSERT INTO public.payslips (
    user_id,
    file_path,
    file_name,
    status
  )
  VALUES (
    p_user_id,
    v_session.object_path,
    v_session.display_file_name,
    'processing'
  )
  RETURNING id INTO v_payslip_id;

  UPDATE public.payslip_check_reservations
  SET payslip_id = v_payslip_id
  WHERE id = v_reservation_id
    AND user_id = p_user_id
    AND upload_session_id = p_session_id
    AND payslip_id IS NULL
    AND provider_started_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload reservation changed during finalisation';
  END IF;

  UPDATE public.payslip_upload_sessions
  SET
    state = 'finalized',
    payslip_id = v_payslip_id,
    actual_bytes = p_actual_bytes,
    detected_mime_type = p_detected_mime_type,
    finalized_at = now()
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND state = 'issued';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload session changed during finalisation';
  END IF;

  RETURN jsonb_build_object('status', 'finalized', 'payslip_id', v_payslip_id::text);
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_payslip_upload_session(uuid, uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_payslip_upload_session(uuid, uuid, bigint, text) TO service_role;

-- List and settle only sessions whose signed-upload token window has elapsed.
-- Until then Storage must retain the object: removing it early would allow an
-- already-issued, non-revocable token to create a new untracked object at the
-- same path.
CREATE OR REPLACE FUNCTION public.list_expired_payslip_upload_sessions(
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

REVOKE ALL ON FUNCTION public.list_expired_payslip_upload_sessions(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_expired_payslip_upload_sessions(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_payslip_upload_session_expiry(
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

  -- cleanup_pending is an owner-requested deletion. A row can only reach this
  -- state through the request RPC below, which atomically fences retries
  -- before the Edge Function removes the object.
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

REVOKE ALL ON FUNCTION public.complete_payslip_upload_session_expiry(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_payslip_upload_session_expiry(uuid, uuid) TO service_role;

-- A failed signature/content validation cannot safely remove an object before
-- the two-hour signed-upload token dies. Mark it for server cleanup instead;
-- the cleanup worker performs deletion only after expiry and verifies absence
-- before it releases the unused reservation.
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

-- Claim a failed automatic check before its private object is removed. The
-- row-level lock and cleanup_requested_at check constraint are the fencing
-- boundary between deletion and a concurrent retry request.
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

  -- Every code path that needs both rows locks the upload session first,
  -- then the payslip row. Keeping this order aligned with the expiry worker
  -- avoids cleanup/retry deadlocks under concurrent requests.
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
      RETURN jsonb_build_object(
        'status', 'waiting_for_token_expiry',
        'expires_at', v_session.expires_at
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ready',
    'object_path', v_payslip.file_path
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.request_failed_payslip_cleanup(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_failed_payslip_cleanup(uuid, uuid) TO service_role;

-- Called only after the service-role Edge Function has removed a failed
-- original. Rechecking storage in the same transaction keeps the database row
-- as the recovery handle whenever object cleanup is uncertain.
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
    -- This finalizer is a security boundary in its own right. It must not
    -- destroy the tracking session until the bearer upload token has expired,
    -- even if a buggy or future service-side caller reaches it directly.
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

  -- Keep a provider-dispatched cost ledger, but remove a never-dispatched
  -- reservation alongside its failed private document.
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
