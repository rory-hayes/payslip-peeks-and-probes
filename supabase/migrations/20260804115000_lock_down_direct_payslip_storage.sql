-- FINAL ROLLOUT STEP: apply only after the deployed web build and the minimum
-- supported native build both use start/finish-payslip-upload, server-issued
-- original URLs, and delete-failed-payslip. Old native binaries rely on the
-- policies removed below and must be blocked or upgraded first.

DROP POLICY IF EXISTS "Users can upload own payslips" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own payslips" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own payslips" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own payslips" ON storage.objects;

-- A payslip row is now proof that the server validated one scoped upload
-- session. A browser can still read its own records and confirm a review, but
-- cannot create an arbitrary processing row through PostgREST.
DROP POLICY IF EXISTS "Users can insert own payslips" ON public.payslips;

CREATE OR REPLACE FUNCTION public.enforce_client_payslip_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A payslip may only belong to the authenticated user';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Payslips must be created through the secure upload service';
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
$function$;

-- The old RPC assumed the browser had already removed the object. Retire that
-- browser-controlled destructive path in favour of the authenticated Edge
-- Function and its server-side storage recheck.
REVOKE EXECUTE ON FUNCTION public.delete_failed_payslip(uuid) FROM authenticated;
