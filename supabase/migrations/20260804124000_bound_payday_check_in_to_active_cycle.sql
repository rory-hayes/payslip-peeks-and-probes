-- A manual check-in belongs only to the currently open pay cycle. The browser
-- hides this action after payday, but the database must enforce the same rule
-- so a direct RPC call cannot attach new data to an ended plan.
CREATE OR REPLACE FUNCTION public.save_payday_check_in(
  p_plan_id uuid,
  p_everyday_remaining numeric
)
RETURNS public.payday_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved_plan public.payday_plans;
  planned_everyday numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Choose an active payday plan';
  END IF;

  IF p_everyday_remaining IS NULL OR p_everyday_remaining < 0 THEN
    RAISE EXCEPTION 'Check the everyday money left';
  END IF;

  SELECT *
  INTO saved_plan
  FROM public.payday_plans
  WHERE id = p_plan_id
    AND user_id = auth.uid()
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an active payday plan';
  END IF;

  -- UK and Ireland share this local calendar. Do not use a server timezone
  -- that could keep a completed plan open after the customer has reached a
  -- new payday.
  IF saved_plan.next_payday <= timezone('Europe/Dublin', now())::date THEN
    RAISE EXCEPTION 'Update your next payday before saving a check-in';
  END IF;

  SELECT amount
  INTO planned_everyday
  FROM public.payday_plan_allocations
  WHERE plan_id = saved_plan.id
    AND category = 'everyday_spending';

  IF coalesce(planned_everyday, 0) <= 0 THEN
    RAISE EXCEPTION 'Add an everyday-spending amount to this plan first';
  END IF;

  IF p_everyday_remaining > planned_everyday THEN
    RAISE EXCEPTION 'Everyday money left cannot exceed the amount planned';
  END IF;

  UPDATE public.payday_plans
  SET
    everyday_remaining = p_everyday_remaining,
    everyday_checked_in_at = now()
  WHERE id = saved_plan.id
  RETURNING * INTO saved_plan;

  RETURN saved_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.save_payday_check_in(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_payday_check_in(uuid, numeric) TO authenticated;
