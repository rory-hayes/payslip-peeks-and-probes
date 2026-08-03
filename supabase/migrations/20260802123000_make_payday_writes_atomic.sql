-- The mobile client must never leave a confirmed payslip without its confirmed
-- figures, or a partly-written payday plan. These RPCs validate ownership and
-- perform the related writes in one database transaction.

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
SECURITY INVOKER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.save_payday_plan(
  p_payslip_id uuid,
  p_pay_date date,
  p_next_payday date,
  p_currency text,
  p_net_pay numeric,
  p_essential_bills numeric,
  p_everyday_spending numeric,
  p_buffer numeric
)
RETURNS public.payday_plans
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  saved_plan public.payday_plans;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_payslip_id IS NULL OR p_pay_date IS NULL OR p_next_payday IS NULL OR p_next_payday <= p_pay_date THEN
    RAISE EXCEPTION 'Choose a confirmed payslip and a next payday after this pay date';
  END IF;

  IF p_currency NOT IN ('GBP', 'EUR') THEN
    RAISE EXCEPTION 'Unsupported plan currency';
  END IF;

  IF p_net_pay IS NULL OR p_net_pay < 0
    OR coalesce(p_essential_bills, 0) < 0
    OR coalesce(p_everyday_spending, 0) < 0
    OR coalesce(p_buffer, 0) < 0 THEN
    RAISE EXCEPTION 'Plan amounts cannot be negative';
  END IF;

  IF coalesce(p_essential_bills, 0) + coalesce(p_everyday_spending, 0) + coalesce(p_buffer, 0) > p_net_pay THEN
    RAISE EXCEPTION 'Plan allocations cannot exceed net pay';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.payslips
    WHERE id = p_payslip_id
      AND user_id = auth.uid()
      AND status = 'completed'
      AND pay_date = p_pay_date
  ) THEN
    RAISE EXCEPTION 'The plan must use one of your confirmed payslips';
  END IF;

  INSERT INTO public.payday_plans (
    user_id,
    payslip_id,
    pay_date,
    next_payday,
    currency,
    net_pay,
    status
  )
  VALUES (
    auth.uid(),
    p_payslip_id,
    p_pay_date,
    p_next_payday,
    p_currency,
    p_net_pay,
    'active'
  )
  ON CONFLICT (user_id, pay_date) DO UPDATE
  SET
    payslip_id = EXCLUDED.payslip_id,
    next_payday = EXCLUDED.next_payday,
    currency = EXCLUDED.currency,
    net_pay = EXCLUDED.net_pay,
    status = 'active'
  RETURNING * INTO saved_plan;

  INSERT INTO public.payday_plan_allocations (plan_id, category, amount)
  VALUES
    (saved_plan.id, 'essential_bills', coalesce(p_essential_bills, 0)),
    (saved_plan.id, 'everyday_spending', coalesce(p_everyday_spending, 0)),
    (saved_plan.id, 'buffer', coalesce(p_buffer, 0))
  ON CONFLICT (plan_id, category) DO UPDATE
  SET amount = EXCLUDED.amount;

  UPDATE public.payday_plans
  SET status = 'archived'
  WHERE user_id = auth.uid()
    AND status = 'active'
    AND id <> saved_plan.id;

  RETURN saved_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.save_payday_plan(uuid, date, date, text, numeric, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_payday_plan(uuid, date, date, text, numeric, numeric, numeric, numeric) TO authenticated;
