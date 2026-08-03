-- A failed automatic check must not strand an owner with an unreadable file.
-- This migration permits a deliberately-started, blank human review while
-- keeping direct client-side status changes and deletion forbidden.

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
    OR (
      NEW.processing_failure_code IS DISTINCT FROM OLD.processing_failure_code
      AND NOT (
        OLD.status = 'failed'
        AND NEW.status IS NOT DISTINCT FROM 'needs_review'
        AND NEW.processing_failure_code IS NULL
        AND current_setting('payslip_insights.beginning_manual_review', true) IS NOT DISTINCT FROM 'true'
      )
    ) THEN
    RAISE EXCEPTION 'Only the processing service may change processing metadata';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (
      (
        OLD.status = 'needs_review'
        AND NEW.status IS NOT DISTINCT FROM 'completed'
        AND current_setting('payslip_insights.confirming_review', true) IS NOT DISTINCT FROM 'true'
      )
      OR (
        OLD.status = 'failed'
        AND NEW.status IS NOT DISTINCT FROM 'needs_review'
        AND current_setting('payslip_insights.beginning_manual_review', true) IS NOT DISTINCT FROM 'true'
      )
    ) THEN
    RAISE EXCEPTION 'Only a bounded review flow can change a payslip status';
  END IF;

  RETURN NEW;
END;
$$;

-- Opens an empty review only for the calling owner's failed payslip. Existing
-- provider output and prompts are cleared so a person cannot mistake an old,
-- partial result for verified figures. The standard confirmation RPC remains
-- the only way this record can enter pay history.
CREATE OR REPLACE FUNCTION public.begin_manual_payslip_review(
  p_payslip_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  manual_payslip_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT id
  INTO manual_payslip_id
  FROM public.payslips
  WHERE id = p_payslip_id
    AND user_id = auth.uid()
    AND status = 'failed'
  FOR UPDATE;

  IF manual_payslip_id IS NULL THEN
    RAISE EXCEPTION 'Only your own failed payslip can be opened for manual review';
  END IF;

  UPDATE public.payslip_extractions
  SET
    extraction_status = 'pending',
    confidence_score = null,
    gross_pay = null,
    net_pay = null,
    taxable_pay = null,
    tax_amount = null,
    national_insurance_amount = null,
    prsi_amount = null,
    usc_amount = null,
    social_security_amount = null,
    solidarity_amount = null,
    church_tax_amount = null,
    pension_amount = null,
    student_loan_amount = null,
    bonus_amount = null,
    overtime_amount = null,
    total_deductions = null,
    year_to_date_json = null,
    raw_extraction_json = null,
    normalized_json = null
  WHERE payslip_id = manual_payslip_id;

  IF NOT FOUND THEN
    INSERT INTO public.payslip_extractions (payslip_id, extraction_status)
    VALUES (manual_payslip_id, 'pending');
  END IF;

  DELETE FROM public.anomaly_results
  WHERE payslip_id = manual_payslip_id;

  PERFORM set_config('payslip_insights.beginning_manual_review', 'true', true);

  UPDATE public.payslips
  SET
    status = 'needs_review',
    pay_date = null,
    pay_period_start = null,
    pay_period_end = null,
    country = null,
    processing_failure_code = null
  WHERE id = manual_payslip_id
    AND user_id = auth.uid()
    AND status = 'failed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This payslip could not be opened for manual review';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_manual_payslip_review(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_manual_payslip_review(uuid) TO authenticated;

-- Deleting a failed upload is a two-step recovery action: the client removes
-- the only object it can own in Storage first, then this RPC verifies that the
-- matching object is gone before it removes the failed database record.
CREATE OR REPLACE FUNCTION public.delete_failed_payslip(
  p_payslip_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  failed_payslip_id uuid;
  failed_file_path text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT id, file_path
  INTO failed_payslip_id, failed_file_path
  FROM public.payslips
  WHERE id = p_payslip_id
    AND user_id = auth.uid()
    AND status = 'failed'
  FOR UPDATE;

  IF failed_payslip_id IS NULL THEN
    RAISE EXCEPTION 'Only your own failed payslip can be removed';
  END IF;

  IF failed_file_path IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM storage.objects
      WHERE bucket_id = 'payslips'
        AND name = failed_file_path
    ) THEN
    RAISE EXCEPTION 'Remove the stored file before removing its failed payslip record';
  END IF;

  DELETE FROM public.payslips
  WHERE id = failed_payslip_id
    AND user_id = auth.uid()
    AND status = 'failed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This payslip could not be removed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_failed_payslip(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_failed_payslip(uuid) TO authenticated;

-- All failed-payslip deletion must pass through the storage-presence check in
-- delete_failed_payslip; do not leave a direct PostgREST delete escape hatch.
DROP POLICY IF EXISTS "Users can delete own payslips" ON public.payslips;
