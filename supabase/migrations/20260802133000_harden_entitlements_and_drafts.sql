-- A stored `active` value cannot by itself prove a recurring entitlement. A
-- delayed webhook must not leave a recurring plan open past its paid period;
-- only a recognised lifetime price may have no period end.
CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text DEFAULT 'live'::text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions AS s
    WHERE s.user_id = user_uuid
      AND user_uuid = auth.uid()
      AND s.environment = check_env
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
  );
$function$;

REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;

-- Legacy billing rows are retained for remotely-verified cancellation and
-- reconciliation only; deleting one in the browser must not make a customer
-- appear eligible for a second checkout.
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.billing_subscriptions;

-- Draft creation is a paid/free-tier feature, so inserting or deleting draft
-- rows cannot remain a browser-controlled operation. Existing drafts stay
-- editable by their owner, but their ownership, payslip and creation date are
-- immutable so the monthly quota cannot be backdated or reassigned.
DROP POLICY IF EXISTS "Users can insert own drafts" ON public.issue_drafts;
DROP POLICY IF EXISTS "Users can delete own drafts" ON public.issue_drafts;

CREATE OR REPLACE FUNCTION public.protect_issue_draft_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.payslip_id IS DISTINCT FROM OLD.payslip_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Issue draft identity cannot be changed';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_issue_draft_identity ON public.issue_drafts;
CREATE TRIGGER protect_issue_draft_identity
  BEFORE UPDATE ON public.issue_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_issue_draft_identity();

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
  v_free_limit constant integer := 2;
  v_month_start timestamptz := (
    date_trunc('month', timezone('Europe/Dublin', now())) AT TIME ZONE 'Europe/Dublin'
  );
BEGIN
  -- This RPC is deliberately private. The Edge Function authenticates the
  -- browser, supplies the configured billing environment, and then calls this
  -- as service_role so a caller cannot claim sandbox access in production.
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

  -- Direct insert/delete policies are gone. The quota is account-wide, so this
  -- lock serialises all first draft creations for one user in the same calendar
  -- month. It prevents two browser tabs on different payslips both seeing the
  -- same remaining draft allowance.
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

  IF NOT v_has_premium THEN
    SELECT count(*)::integer INTO v_drafts_this_month
    FROM public.issue_drafts AS d
    WHERE d.user_id = v_user_id
      AND d.created_at >= v_month_start;

    IF v_drafts_this_month >= v_free_limit THEN
      RAISE EXCEPTION 'Draft limit reached' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.issue_drafts (user_id, payslip_id, subject, body, status)
  VALUES (v_user_id, p_payslip_id, trim(p_subject), p_body, 'draft')
  RETURNING * INTO v_created;

  RETURN QUERY SELECT v_created.id, v_created.subject, v_created.body;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_issue_draft(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_issue_draft(uuid, uuid, text, text, text) TO service_role;
