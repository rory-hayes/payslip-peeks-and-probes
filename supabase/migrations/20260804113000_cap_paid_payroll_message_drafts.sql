-- Paid payroll-message drafts must have a stated server-owned allowance as
-- well as a browser display. This replaces the earlier Free-only gate: all
-- plans use the same account-wide Ireland-calendar-month lock and count.
CREATE OR REPLACE FUNCTION public.create_issue_draft(
  p_user_id uuid,
  p_payslip_id uuid,
  p_subject text,
  p_body text,
  p_environment text
)
RETURNS TABLE (
  id uuid,
  subject text,
  body text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := p_user_id;
  v_existing public.issue_drafts%ROWTYPE;
  v_created public.issue_drafts%ROWTYPE;
  v_has_premium boolean;
  v_drafts_this_month integer;
  v_monthly_limit integer := 2;
  v_month_start timestamptz := (
    date_trunc('month', timezone('Europe/Dublin', now())) AT TIME ZONE 'Europe/Dublin'
  );
BEGIN
  -- This RPC is deliberately private. The Edge Function authenticates the
  -- browser, supplies the configured billing environment, and then calls this
  -- as service_role so a caller cannot choose a different entitlement mode.
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF v_user_id IS NULL OR p_payslip_id IS NULL THEN
    RAISE EXCEPTION 'A user and payslip are required';
  END IF;
  IF p_environment NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Invalid billing environment';
  END IF;
  IF length(trim(coalesce(p_subject, ''))) = 0 OR length(p_subject) > 300 THEN
    RAISE EXCEPTION 'Invalid draft subject';
  END IF;
  IF length(trim(coalesce(p_body, ''))) = 0 OR length(p_body) > 20000 THEN
    RAISE EXCEPTION 'Invalid draft body';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.payslips AS p
    WHERE p.id = p_payslip_id AND p.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Payslip not found';
  END IF;

  -- Serialize first creations across payslips. Existing drafts remain
  -- editable and never consume a second allowance slot.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text || ':' || v_month_start::date::text)::bigint
  );

  SELECT d.* INTO v_existing
  FROM public.issue_drafts AS d
  WHERE d.user_id = v_user_id AND d.payslip_id = p_payslip_id
  ORDER BY d.updated_at DESC, d.id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.subject, v_existing.body;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions AS s
    WHERE s.user_id = v_user_id
      AND s.environment = p_environment
      AND (
        (
          s.price_id IN ('lifetime_once', 'lifetime_once_gbp')
          AND s.status = 'active'
        )
        OR (
          s.price_id IN ('plus_yearly', 'plus_monthly', 'plus_yearly_gbp', 'plus_monthly_gbp')
          AND s.status IN ('active', 'trialing', 'canceled')
          AND s.current_period_end > now()
        )
      )
  ) INTO v_has_premium;

  -- Deliberate launch ceiling. Keep it aligned with `use-usage.ts`, and do
  -- not advertise unlimited drafts while the database remains the cost and
  -- abuse boundary.
  v_monthly_limit := CASE WHEN v_has_premium THEN 12 ELSE 2 END;

  SELECT count(*)::integer INTO v_drafts_this_month
  FROM public.issue_drafts AS d
  WHERE d.user_id = v_user_id
    AND d.created_at >= v_month_start;

  IF v_drafts_this_month >= v_monthly_limit THEN
    RAISE EXCEPTION 'Draft limit reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.issue_drafts (user_id, payslip_id, subject, body, status)
  VALUES (v_user_id, p_payslip_id, trim(p_subject), p_body, 'draft')
  RETURNING * INTO v_created;

  RETURN QUERY SELECT v_created.id, v_created.subject, v_created.body;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_issue_draft(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_issue_draft(uuid, uuid, text, text, text) TO service_role;
