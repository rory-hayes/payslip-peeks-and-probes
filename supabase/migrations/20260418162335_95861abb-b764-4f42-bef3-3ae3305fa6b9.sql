ALTER TABLE public.payslip_extractions
  ADD COLUMN IF NOT EXISTS social_security_amount numeric,
  ADD COLUMN IF NOT EXISTS solidarity_amount numeric,
  ADD COLUMN IF NOT EXISTS church_tax_amount numeric;

COMMENT ON COLUMN public.payslip_extractions.social_security_amount IS
  'Germany: combined employee Sozialversicherung (KV+RV+AV+PV employee share)';
COMMENT ON COLUMN public.payslip_extractions.solidarity_amount IS
  'Germany: Solidaritätszuschlag (5.5% on Lohnsteuer above exemption)';
COMMENT ON COLUMN public.payslip_extractions.church_tax_amount IS
  'Germany: Kirchensteuer (8% or 9% of Lohnsteuer if applicable)';