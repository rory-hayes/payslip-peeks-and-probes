-- Client sessions may add an owned payslip and confirm an extraction review,
-- but must never be able to redirect a privileged processor to another object
-- or reset its cost-control state.

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

    IF NEW.status <> 'processing'
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
    AND NOT (OLD.status = 'needs_review' AND NEW.status = 'completed') THEN
    RAISE EXCEPTION 'Only a reviewed payslip may be confirmed by the user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_client_payslip_mutation ON public.payslips;
CREATE TRIGGER enforce_client_payslip_mutation
  BEFORE INSERT OR UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_payslip_mutation();

-- The processor creates the single pending extraction only after it has
-- atomically claimed the payslip. Browser sessions may still correct their own
-- extracted figures during the review step, but cannot create duplicate rows.
DROP POLICY IF EXISTS "Users can insert own extractions" ON public.payslip_extractions;