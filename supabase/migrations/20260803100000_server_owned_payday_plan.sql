-- A payday plan must stay tied to the figures the customer confirmed on their
-- own payslip. The browser may choose its allocations and next payday, but it
-- must not be able to replace the confirmed pay date, net pay, or currency.

DROP FUNCTION IF EXISTS public.save_payday_plan(uuid, date, date, text, numeric, numeric, numeric, numeric);

CREATE FUNCTION public.save_payday_plan(
  p_payslip_id uuid,
  p_next_payday date,
  p_essential_bills numeric,
  p_everyday_spending numeric,
  p_buffer numeric
)
RETURNS public.payday_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  source_pay_date date;
  source_currency text;
  source_net_pay numeric;
  saved_plan public.payday_plans;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_payslip_id IS NULL OR p_next_payday IS NULL THEN
    RAISE EXCEPTION 'Choose a confirmed payslip and a next payday';
  END IF;

  IF coalesce(p_essential_bills, 0) < 0
    OR coalesce(p_everyday_spending, 0) < 0
    OR coalesce(p_buffer, 0) < 0 THEN
    RAISE EXCEPTION 'Plan amounts cannot be negative';
  END IF;

  SELECT
    payslip.pay_date,
    CASE coalesce(payslip.country, profile.country)
      WHEN 'UK' THEN 'GBP'
      WHEN 'Ireland' THEN 'EUR'
      ELSE NULL
    END,
    extraction.net_pay
  INTO source_pay_date, source_currency, source_net_pay
  FROM public.payslips AS payslip
  JOIN LATERAL (
    SELECT net_pay
    FROM public.payslip_extractions
    WHERE payslip_id = payslip.id
      AND extraction_status = 'completed'
      AND net_pay IS NOT NULL
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  ) AS extraction ON true
  LEFT JOIN public.profiles AS profile ON profile.user_id = payslip.user_id
  WHERE payslip.id = p_payslip_id
    AND payslip.user_id = auth.uid()
    AND payslip.status = 'completed';

  IF source_pay_date IS NULL OR source_net_pay IS NULL OR source_net_pay <= 0 OR source_currency IS NULL THEN
    RAISE EXCEPTION 'The plan must use one of your confirmed payslips';
  END IF;

  IF p_next_payday <= source_pay_date THEN
    RAISE EXCEPTION 'Choose a next payday after the confirmed pay date';
  END IF;

  IF coalesce(p_essential_bills, 0) + coalesce(p_everyday_spending, 0) + coalesce(p_buffer, 0) > source_net_pay THEN
    RAISE EXCEPTION 'Plan allocations cannot exceed net pay';
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
    source_pay_date,
    p_next_payday,
    source_currency,
    source_net_pay,
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

REVOKE ALL ON FUNCTION public.save_payday_plan(uuid, date, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_payday_plan(uuid, date, numeric, numeric, numeric) TO authenticated;

-- The RPC is the only write path. Removing browser write policies means an
-- authenticated client cannot bypass its server-owned payslip checks.
DROP POLICY IF EXISTS "Users can insert own payday plans" ON public.payday_plans;
DROP POLICY IF EXISTS "Users can update own payday plans" ON public.payday_plans;
DROP POLICY IF EXISTS "Users can delete own payday plans" ON public.payday_plans;
DROP POLICY IF EXISTS "Users can insert own payday plan allocations" ON public.payday_plan_allocations;
DROP POLICY IF EXISTS "Users can update own payday plan allocations" ON public.payday_plan_allocations;
DROP POLICY IF EXISTS "Users can delete own payday plan allocations" ON public.payday_plan_allocations;
