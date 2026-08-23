-- Enforce owner-paired references at write time without assuming historical
-- data is clean enough to add immediately-valid composite foreign keys. These
-- triggers apply to service and browser writes alike and prevent a tenant from
-- attaching its own record to another tenant's employer, payslip, or anomaly.

CREATE OR REPLACE FUNCTION public.enforce_payslip_owned_employer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.employer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.employers AS employer
    WHERE employer.id = NEW.employer_id
      AND employer.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'A payslip employer must belong to the same account';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_payslip_owned_employer ON public.payslips;
CREATE TRIGGER enforce_payslip_owned_employer
  BEFORE INSERT OR UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payslip_owned_employer();

CREATE OR REPLACE FUNCTION public.enforce_issue_draft_owned_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.employer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.employers AS employer
    WHERE employer.id = NEW.employer_id
      AND employer.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'A draft employer must belong to the same account';
  END IF;

  IF NEW.payslip_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.payslips AS payslip
    WHERE payslip.id = NEW.payslip_id
      AND payslip.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'A draft payslip must belong to the same account';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_issue_draft_owned_references ON public.issue_drafts;
CREATE TRIGGER enforce_issue_draft_owned_references
  BEFORE INSERT OR UPDATE ON public.issue_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_issue_draft_owned_references();

CREATE OR REPLACE FUNCTION public.enforce_user_note_owned_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.payslip_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.payslips AS payslip
    WHERE payslip.id = NEW.payslip_id
      AND payslip.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'A note payslip must belong to the same account';
  END IF;

  IF NEW.anomaly_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.anomaly_results AS anomaly
    JOIN public.payslips AS payslip ON payslip.id = anomaly.payslip_id
    WHERE anomaly.id = NEW.anomaly_id
      AND payslip.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'A note anomaly must belong to the same account';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_user_note_owned_references ON public.user_notes;
CREATE TRIGGER enforce_user_note_owned_references
  BEFORE INSERT OR UPDATE ON public.user_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_note_owned_references();

-- Prevent new duplicate private-document rows without deleting or rewriting
-- legacy data. The advisory lock closes the race between two concurrent
-- inserts for the same owner/path; a later data audit can replace this with a
-- validated unique index once old duplicates are resolved deliberately.
CREATE OR REPLACE FUNCTION public.enforce_unique_payslip_file_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.file_path IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.file_path IS NOT DISTINCT FROM OLD.file_path
    AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('payslip-file:' || NEW.user_id::text || ':' || NEW.file_path)::bigint
  );

  IF EXISTS (
    SELECT 1
    FROM public.payslips AS payslip
    WHERE payslip.user_id = NEW.user_id
      AND payslip.file_path = NEW.file_path
      AND (TG_OP = 'INSERT' OR payslip.id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'This private payslip file is already attached to this account';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_unique_payslip_file_path ON public.payslips;
CREATE TRIGGER enforce_unique_payslip_file_path
  BEFORE INSERT OR UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_unique_payslip_file_path();

-- Preserve one extraction record per payslip for all new writes. Existing
-- duplicate legacy rows are left untouched until they can be audited rather
-- than being guessed at or destructively merged during a release migration.
CREATE OR REPLACE FUNCTION public.enforce_one_extraction_per_payslip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('payslip-extraction:' || NEW.payslip_id::text)::bigint
  );

  IF EXISTS (
    SELECT 1
    FROM public.payslip_extractions AS extraction
    WHERE extraction.payslip_id = NEW.payslip_id
  ) THEN
    RAISE EXCEPTION 'A payslip can have only one extraction record';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_one_extraction_per_payslip ON public.payslip_extractions;
CREATE TRIGGER enforce_one_extraction_per_payslip
  BEFORE INSERT ON public.payslip_extractions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_extraction_per_payslip();
