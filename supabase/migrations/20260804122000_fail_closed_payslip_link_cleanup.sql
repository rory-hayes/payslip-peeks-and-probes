-- A failed-payslip cleanup is a removal fence as well as a Storage cleanup.
-- Once it has started, no fresh original-document bearer link may be exposed.
-- Conversely, a previously exposed short-lived link must be allowed to expire
-- before the scheduled cleanup removes the object. The database owns both
-- decisions so two browser tabs and the protected worker cannot interleave a
-- link issuance with a failed-upload removal.

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
  v_cleanup_requested_at timestamptz;
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

  -- Keep the session -> payslip -> lease order used by failed-upload cleanup.
  -- A cleanup request may arrive after the Edge Function's initial read but
  -- before this reservation, so this transaction is the authoritative fence.
  SELECT session.state INTO v_session_state
  FROM public.payslip_upload_sessions AS session
  WHERE session.payslip_id = p_payslip_id
    AND session.user_id = p_user_id
  FOR KEY SHARE;
  IF FOUND AND v_session_state = 'cleanup_pending' THEN
    RETURN jsonb_build_object('status', 'cleanup_pending');
  END IF;

  SELECT payslip.file_path, payslip.cleanup_requested_at
  INTO v_object_path, v_cleanup_requested_at
  FROM public.payslips AS payslip
  WHERE payslip.id = p_payslip_id
    AND payslip.user_id = p_user_id
  FOR KEY SHARE;
  IF NOT FOUND OR v_object_path IS DISTINCT FROM p_object_path THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_cleanup_requested_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'cleanup_pending');
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
  v_session_state text;
  v_object_path text;
  v_cleanup_requested_at timestamptz;
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

  -- Recheck both failed-cleanup fences after Storage has minted an undisclosed
  -- URL. This is intentionally before locking the lease so cleanup and link
  -- activation share session -> payslip -> lease ordering.
  SELECT session.state INTO v_session_state
  FROM public.payslip_upload_sessions AS session
  WHERE session.payslip_id = p_payslip_id
    AND session.user_id = p_user_id
  FOR KEY SHARE;
  IF FOUND AND v_session_state = 'cleanup_pending' THEN
    RETURN jsonb_build_object('status', 'cleanup_pending');
  END IF;

  SELECT payslip.file_path, payslip.cleanup_requested_at
  INTO v_object_path, v_cleanup_requested_at
  FROM public.payslips AS payslip
  WHERE payslip.id = p_payslip_id
    AND payslip.user_id = p_user_id
  FOR KEY SHARE;
  IF NOT FOUND OR v_object_path IS DISTINCT FROM p_object_path THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF v_cleanup_requested_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'cleanup_pending');
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
  v_active_read_link_expires_at timestamptz;
  v_defer_until timestamptz;
  v_has_session boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_payslip_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'A payslip and user are required';
  END IF;

  -- Lock session before payslip, then any active link. The inverse order would
  -- deadlock with reserve/activation under a two-tab cleanup race.
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

  IF v_has_session
    AND (v_session.state NOT IN ('finalized', 'cleanup_pending')
      OR v_session.object_path IS DISTINCT FROM v_payslip.file_path) THEN
    RETURN jsonb_build_object('status', 'needs_review');
  END IF;

  SELECT lease.expires_at INTO v_active_read_link_expires_at
  FROM public.payslip_original_link_leases AS lease
  WHERE lease.user_id = p_user_id
    AND lease.payslip_id = p_payslip_id
    AND lease.expires_at > now()
  ORDER BY lease.expires_at DESC, lease.id DESC
  LIMIT 1
  FOR KEY SHARE;

  -- Persist this fence even while a previously issued bearer link is allowed
  -- to expire. New reserve/activation calls read this same state and fail.
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
  END IF;

  v_defer_until := v_active_read_link_expires_at;
  IF v_has_session AND v_session.expires_at > now()
    AND (v_defer_until IS NULL OR v_session.expires_at > v_defer_until) THEN
    v_defer_until := v_session.expires_at;
  END IF;
  IF v_defer_until IS NOT NULL THEN
    -- Preserve the established API status while including the later of the
    -- non-revocable upload credential and original-link expiry.
    RETURN jsonb_build_object('status', 'waiting_for_token_expiry', 'expires_at', v_defer_until);
  END IF;

  RETURN jsonb_build_object('status', 'ready', 'object_path', v_payslip.file_path);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_failed_payslip_cleanup(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_failed_payslip_cleanup(uuid, uuid) TO service_role;

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
    -- Once cleanup_pending is committed, no new read lease can begin. Skip a
    -- pre-existing link until it expires so the protected worker never deletes
    -- an object while the bearer URL is still valid.
    AND (
      session.state <> 'cleanup_pending'
      OR NOT EXISTS (
        SELECT 1
        FROM public.payslip_original_link_leases AS lease
        WHERE lease.user_id = session.user_id
          AND lease.payslip_id = session.payslip_id
          AND lease.expires_at > now()
      )
    )
  ORDER BY session.expires_at ASC, session.id ASC
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_expired_secure_payslip_upload_sessions(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_expired_secure_payslip_upload_sessions(uuid, integer) TO service_role;

-- Legacy failed rows may have no upload-session record. They use the same
-- cleanup_requested_at fence, so the protected worker gets a separate bounded
-- worklist once any active original-document link has expired.
CREATE OR REPLACE FUNCTION public.list_expired_secure_failed_payslip_cleanups_without_session(
  p_limit integer DEFAULT 100
)
RETURNS TABLE(payslip_id uuid, user_id uuid, object_path text)
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
  SELECT payslip.id, payslip.user_id, payslip.file_path
  FROM public.payslips AS payslip
  WHERE payslip.status = 'failed'
    AND payslip.cleanup_requested_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.payslip_upload_sessions AS session
      WHERE session.payslip_id = payslip.id
        AND session.user_id = payslip.user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.payslip_original_link_leases AS lease
      WHERE lease.user_id = payslip.user_id
        AND lease.payslip_id = payslip.id
        AND lease.expires_at > now()
    )
  ORDER BY payslip.cleanup_requested_at ASC, payslip.id ASC
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_expired_secure_failed_payslip_cleanups_without_session(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_expired_secure_failed_payslip_cleanups_without_session(integer) TO service_role;
