-- A confirmed payslip is the trust boundary between an extracted document and
-- the payday plan. Only the atomic review RPC may cross that boundary.
--
-- The former client-update policies allowed an authenticated user to mark a
-- pending payslip as completed (or modify the extraction independently of the
-- review). That did not expose another user's data, but it meant the app could
-- no longer distinguish a human-confirmed record from a direct API write.

CREATE OR REPLACE FUNCTION public.enforce_client_payslip_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Edge Functions use the service-role JWT. All other writes are treated as
  -- browser-originated, including direct PostgREST calls made by a user.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A payslip may only belong to the authenticated user';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.file_path IS NULL
      OR NEW.file_path !~ ('^' || auth.uid()::text || '/[^/]+$') THEN
      RAISE EXCEPTION 'Payslip storage paths must be a single file under the authenticated user prefix';
    END IF;

    IF NEW.status IS DISTINCT FROM 'processing'
      OR NEW.processing_attempts <> 0
      OR NEW.processing_started_at IS NOT NULL
      OR NEW.processing_finished_at IS NOT NULL
      OR NEW.processing_failure_code IS NOT NULL THEN
      RAISE EXCEPTION 'Only the processing service may set initial processing state';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.file_path IS DISTINCT FROM OLD.file_path
    OR NEW.file_name IS DISTINCT FROM OLD.file_name THEN
    RAISE EXCEPTION 'Payslip ownership and stored file cannot be changed';
  END IF;

  IF NEW.processing_attempts IS DISTINCT FROM OLD.processing_attempts
    OR NEW.processing_started_at IS DISTINCT FROM OLD.processing_started_at
    OR NEW.processing_finished_at IS DISTINCT FROM OLD.processing_finished_at
    OR NEW.processing_failure_code IS DISTINCT FROM OLD.processing_failure_code THEN
    RAISE EXCEPTION 'Only the processing service may change processing metadata';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (
      OLD.status = 'needs_review'
      AND NEW.status IS NOT DISTINCT FROM 'completed'
      AND current_setting('payslip_insights.confirming_review', true) IS NOT DISTINCT FROM 'true'
    ) THEN
    RAISE EXCEPTION 'Only the review confirmation can complete a payslip';
  END IF;

  RETURN NEW;
END;
$$;

-- The legacy browser review and the Expo client both use this function. It
-- validates the caller from the JWT, bypasses RLS only for its own bounded
-- writes, and sets a transaction-local marker checked by the trigger above.
CREATE OR REPLACE FUNCTION public.confirm_payslip_review(
  p_payslip_id uuid,
  p_pay_date date,
  p_gross_pay numeric,
  p_net_pay numeric,
  p_tax_amount numeric,
  p_national_insurance_amount numeric,
  p_prsi_amount numeric,
  p_usc_amount numeric,
  p_pension_amount numeric,
  p_total_deductions numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  confirmed_payslip_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_pay_date IS NULL OR p_gross_pay IS NULL OR p_gross_pay <= 0 OR p_net_pay IS NULL OR p_net_pay <= 0 THEN
    RAISE EXCEPTION 'A pay date, gross pay, and net pay are required';
  END IF;

  IF coalesce(p_tax_amount, 0) < 0
    OR coalesce(p_national_insurance_amount, 0) < 0
    OR coalesce(p_prsi_amount, 0) < 0
    OR coalesce(p_usc_amount, 0) < 0
    OR coalesce(p_pension_amount, 0) < 0
    OR coalesce(p_total_deductions, 0) < 0 THEN
    RAISE EXCEPTION 'Deduction amounts cannot be negative';
  END IF;

  PERFORM set_config('payslip_insights.confirming_review', 'true', true);

  UPDATE public.payslips
  SET
    pay_date = p_pay_date,
    status = 'completed'
  WHERE id = p_payslip_id
    AND user_id = auth.uid()
    AND status = 'needs_review'
  RETURNING id INTO confirmed_payslip_id;

  IF confirmed_payslip_id IS NULL THEN
    RAISE EXCEPTION 'Only your own payslip awaiting review can be confirmed';
  END IF;

  UPDATE public.payslip_extractions
  SET
    gross_pay = p_gross_pay,
    net_pay = p_net_pay,
    tax_amount = p_tax_amount,
    national_insurance_amount = p_national_insurance_amount,
    prsi_amount = p_prsi_amount,
    usc_amount = p_usc_amount,
    pension_amount = p_pension_amount,
    total_deductions = p_total_deductions,
    extraction_status = 'completed'
  WHERE payslip_id = confirmed_payslip_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No extraction exists for this payslip';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_payslip_review(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_payslip_review(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) TO authenticated;

-- Review values are written through the RPC above; users still retain read and
-- delete access to their own payslips via the existing policies.
DROP POLICY IF EXISTS "Users can update own payslips" ON public.payslips;
DROP POLICY IF EXISTS "Users can update own extractions" ON public.payslip_extractions;

-- A server crash after a claim must not leave a user's file permanently stuck
-- in processing. A fresh invocation may reclaim only a stale claim; normal
-- concurrent requests still get a clean conflict response.
CREATE OR REPLACE FUNCTION public.claim_payslip_processing(
  p_payslip_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed boolean;
BEGIN
  UPDATE public.payslips
  SET
    processing_started_at = now(),
    processing_finished_at = null,
    processing_failure_code = null,
    processing_attempts = processing_attempts + 1
  WHERE id = p_payslip_id
    AND user_id = p_user_id
    AND status = 'processing'
    AND processing_attempts < 3
    AND (
      processing_started_at IS NULL
      OR processing_started_at < now() - interval '20 minutes'
    )
  RETURNING true INTO claimed;

  RETURN coalesce(claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payslip_processing(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_payslip_processing(uuid, uuid) TO service_role;
