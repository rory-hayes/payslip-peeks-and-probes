-- The recurring product loop is intentionally narrow:
-- confirmed payslip -> plan the period -> see the remaining room -> next pay.
-- These tables contain only user-entered planning data. They never imply bank
-- access, payment initiation, investment advice, or a tax calculation.

CREATE TABLE public.payday_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payslip_id uuid REFERENCES public.payslips(id) ON DELETE SET NULL,
  pay_date date NOT NULL,
  next_payday date NOT NULL,
  currency text NOT NULL CHECK (currency IN ('GBP', 'EUR')),
  net_pay numeric(12, 2) NOT NULL CHECK (net_pay >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payday_plans_pay_dates_in_order CHECK (next_payday > pay_date),
  CONSTRAINT payday_plans_user_pay_date_unique UNIQUE (user_id, pay_date)
);

CREATE INDEX payday_plans_user_status_idx
  ON public.payday_plans (user_id, status, pay_date DESC);

ALTER TABLE public.payday_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payday plans"
  ON public.payday_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payday plans"
  ON public.payday_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payday plans"
  ON public.payday_plans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own payday plans"
  ON public.payday_plans FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_payday_plans_updated_at
  BEFORE UPDATE ON public.payday_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payday_plan_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.payday_plans(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('essential_bills', 'everyday_spending', 'buffer')),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payday_plan_allocations_plan_category_unique UNIQUE (plan_id, category)
);

CREATE INDEX payday_plan_allocations_plan_idx
  ON public.payday_plan_allocations (plan_id);

ALTER TABLE public.payday_plan_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payday plan allocations"
  ON public.payday_plan_allocations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.payday_plans
    WHERE payday_plans.id = payday_plan_allocations.plan_id
      AND payday_plans.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own payday plan allocations"
  ON public.payday_plan_allocations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payday_plans
    WHERE payday_plans.id = payday_plan_allocations.plan_id
      AND payday_plans.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own payday plan allocations"
  ON public.payday_plan_allocations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.payday_plans
    WHERE payday_plans.id = payday_plan_allocations.plan_id
      AND payday_plans.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payday_plans
    WHERE payday_plans.id = payday_plan_allocations.plan_id
      AND payday_plans.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own payday plan allocations"
  ON public.payday_plan_allocations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.payday_plans
    WHERE payday_plans.id = payday_plan_allocations.plan_id
      AND payday_plans.user_id = auth.uid()
  ));
CREATE TRIGGER update_payday_plan_allocations_updated_at
  BEFORE UPDATE ON public.payday_plan_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.recurring_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  due_day smallint CHECK (due_day BETWEEN 1 AND 31),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'annual', 'other')),
  is_essential boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recurring_bills_user_active_idx
  ON public.recurring_bills (user_id, is_active, due_day);

ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own recurring bills"
  ON public.recurring_bills FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_recurring_bills_updated_at
  BEFORE UPDATE ON public.recurring_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  target_amount numeric(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  currency text NOT NULL CHECK (currency IN ('GBP', 'EUR')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX savings_goals_one_primary_per_user_idx
  ON public.savings_goals (user_id) WHERE is_primary;

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own savings goals"
  ON public.savings_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_savings_goals_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();