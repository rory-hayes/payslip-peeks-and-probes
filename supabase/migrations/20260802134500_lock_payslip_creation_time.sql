-- A browser-controlled creation time lets a free user backdate a payslip and
-- evade the server-side monthly processing limit. The client may create its
-- own pending row, but the database, not the browser, owns when that row was
-- created. Service-role writes remain available for operational recovery.
CREATE OR REPLACE FUNCTION public.enforce_client_payslip_created_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A payslip may only belong to the authenticated user';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ignore a caller-supplied timestamp rather than trusting it for quotas.
    NEW.created_at := now();
  ELSIF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Payslip creation time cannot be changed';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_client_payslip_created_at ON public.payslips;
CREATE TRIGGER enforce_client_payslip_created_at
  BEFORE INSERT OR UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_payslip_created_at();

CREATE INDEX IF NOT EXISTS payslips_user_created_at_idx
  ON public.payslips (user_id, created_at DESC);
