-- A human review must be able to correct a UK/Ireland classification before it
-- becomes a confirmed payslip. The country remains server-validated and the
-- mobile client can omit it during a staged rollout, preserving its existing
-- confirmed country until its country picker ships.
DROP FUNCTION IF EXISTS public.confirm_payslip_review(
  uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric
);

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
  p_total_deductions numeric,
  p_country text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  confirmed_payslip_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_country IS NOT NULL AND p_country NOT IN ('UK', 'Ireland') THEN
    RAISE EXCEPTION 'A reviewed payslip country must be UK or Ireland';
  END IF;

  -- PostgreSQL numeric accepts NaN, but it is never a meaningful payslip
  -- amount. Reject it explicitly instead of relying on normal comparisons.
  IF p_pay_date IS NULL
    OR p_gross_pay IS NULL OR p_gross_pay = 'NaN'::numeric OR p_gross_pay <= 0
    OR p_net_pay IS NULL OR p_net_pay = 'NaN'::numeric OR p_net_pay <= 0 THEN
    RAISE EXCEPTION 'A pay date, gross pay, and net pay are required';
  END IF;

  IF coalesce(p_tax_amount, 0) = 'NaN'::numeric
    OR coalesce(p_national_insurance_amount, 0) = 'NaN'::numeric
    OR coalesce(p_prsi_amount, 0) = 'NaN'::numeric
    OR coalesce(p_usc_amount, 0) = 'NaN'::numeric
    OR coalesce(p_pension_amount, 0) = 'NaN'::numeric
    OR coalesce(p_total_deductions, 0) = 'NaN'::numeric
    OR coalesce(p_tax_amount, 0) < 0
    OR coalesce(p_national_insurance_amount, 0) < 0
    OR coalesce(p_prsi_amount, 0) < 0
    OR coalesce(p_usc_amount, 0) < 0
    OR coalesce(p_pension_amount, 0) < 0
    OR coalesce(p_total_deductions, 0) < 0 THEN
    RAISE EXCEPTION 'Deduction amounts must be valid, non-negative numbers';
  END IF;

  PERFORM set_config('payslip_insights.confirming_review', 'true', true);

  UPDATE public.payslips
  SET
    pay_date = p_pay_date,
    country = coalesce(p_country, country),
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
$function$;

REVOKE ALL ON FUNCTION public.confirm_payslip_review(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_payslip_review(uuid, date, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text) TO authenticated;

-- Do not let a future direct write or service regression persist a numeric
-- NaN. NOT VALID protects all new/changed rows without assuming legacy data is
-- clean; audit and validate existing records before relying on it as a full
-- historical guarantee.
ALTER TABLE public.payslip_extractions
  DROP CONSTRAINT IF EXISTS payslip_extractions_review_amounts_not_nan;

ALTER TABLE public.payslip_extractions
  ADD CONSTRAINT payslip_extractions_review_amounts_not_nan
  CHECK (
    (gross_pay IS NULL OR gross_pay <> 'NaN'::numeric)
    AND (net_pay IS NULL OR net_pay <> 'NaN'::numeric)
    AND (tax_amount IS NULL OR tax_amount <> 'NaN'::numeric)
    AND (national_insurance_amount IS NULL OR national_insurance_amount <> 'NaN'::numeric)
    AND (prsi_amount IS NULL OR prsi_amount <> 'NaN'::numeric)
    AND (usc_amount IS NULL OR usc_amount <> 'NaN'::numeric)
    AND (pension_amount IS NULL OR pension_amount <> 'NaN'::numeric)
    AND (total_deductions IS NULL OR total_deductions <> 'NaN'::numeric)
  ) NOT VALID;
