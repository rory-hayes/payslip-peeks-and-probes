
-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT,
  country TEXT CHECK (country IN ('UK', 'Ireland')),
  pay_frequency TEXT CHECK (pay_frequency IN ('weekly', 'fortnightly', 'monthly', 'other')),
  onboarding_complete BOOLEAN DEFAULT false,
  employer_name TEXT,
  payroll_email TEXT,
  has_pension BOOLEAN DEFAULT false,
  has_student_loan BOOLEAN DEFAULT false,
  has_bonus BOOLEAN DEFAULT false,
  has_benefits BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'first_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Employers table
CREATE TABLE public.employers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  payroll_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own employers" ON public.employers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own employers" ON public.employers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own employers" ON public.employers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own employers" ON public.employers FOR DELETE USING (auth.uid() = user_id);

-- Payslips table
CREATE TABLE public.payslips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  employer_id UUID REFERENCES public.employers(id),
  file_path TEXT,
  file_name TEXT,
  pay_date DATE,
  pay_period_start DATE,
  pay_period_end DATE,
  country TEXT CHECK (country IN ('UK', 'Ireland')),
  status TEXT DEFAULT 'processing' CHECK (status IN ('uploading', 'processing', 'extracted', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payslips" ON public.payslips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payslips" ON public.payslips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payslips" ON public.payslips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payslips" ON public.payslips FOR DELETE USING (auth.uid() = user_id);

-- Payslip extractions
CREATE TABLE public.payslip_extractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payslip_id UUID REFERENCES public.payslips(id) ON DELETE CASCADE NOT NULL,
  extraction_status TEXT DEFAULT 'pending',
  confidence_score NUMERIC,
  gross_pay NUMERIC,
  net_pay NUMERIC,
  taxable_pay NUMERIC,
  tax_amount NUMERIC,
  national_insurance_amount NUMERIC,
  prsi_amount NUMERIC,
  usc_amount NUMERIC,
  pension_amount NUMERIC,
  student_loan_amount NUMERIC,
  bonus_amount NUMERIC,
  overtime_amount NUMERIC,
  total_deductions NUMERIC,
  year_to_date_json JSONB,
  raw_extraction_json JSONB,
  normalized_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payslip_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own extractions" ON public.payslip_extractions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.payslips WHERE payslips.id = payslip_extractions.payslip_id AND payslips.user_id = auth.uid()));
CREATE POLICY "Users can insert own extractions" ON public.payslip_extractions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.payslips WHERE payslips.id = payslip_extractions.payslip_id AND payslips.user_id = auth.uid()));
CREATE POLICY "Users can update own extractions" ON public.payslip_extractions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.payslips WHERE payslips.id = payslip_extractions.payslip_id AND payslips.user_id = auth.uid()));
CREATE TRIGGER update_extractions_updated_at BEFORE UPDATE ON public.payslip_extractions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anomaly results
CREATE TABLE public.anomaly_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payslip_id UUID REFERENCES public.payslips(id) ON DELETE CASCADE NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')) NOT NULL,
  confidence TEXT CHECK (confidence IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'raised', 'resolved')),
  suggested_action TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.anomaly_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own anomalies" ON public.anomaly_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.payslips WHERE payslips.id = anomaly_results.payslip_id AND payslips.user_id = auth.uid()));
CREATE POLICY "Users can update own anomalies" ON public.anomaly_results FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.payslips WHERE payslips.id = anomaly_results.payslip_id AND payslips.user_id = auth.uid()));
CREATE TRIGGER update_anomalies_updated_at BEFORE UPDATE ON public.anomaly_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Issue drafts
CREATE TABLE public.issue_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payslip_id UUID REFERENCES public.payslips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  employer_id UUID REFERENCES public.employers(id),
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.issue_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own drafts" ON public.issue_drafts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own drafts" ON public.issue_drafts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own drafts" ON public.issue_drafts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own drafts" ON public.issue_drafts FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_drafts_updated_at BEFORE UPDATE ON public.issue_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User notes
CREATE TABLE public.user_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payslip_id UUID REFERENCES public.payslips(id) ON DELETE CASCADE,
  anomaly_id UUID REFERENCES public.anomaly_results(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notes" ON public.user_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.user_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.user_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.user_notes FOR DELETE USING (auth.uid() = user_id);

-- Billing subscriptions
CREATE TABLE public.billing_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'plus')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.billing_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE TRIGGER update_billing_updated_at BEFORE UPDATE ON public.billing_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit events
CREATE TABLE public.audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit events" ON public.audit_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audit events" ON public.audit_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage bucket for payslip files
INSERT INTO storage.buckets (id, name, public) VALUES ('payslips', 'payslips', false);

CREATE POLICY "Users can upload own payslips" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payslips' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own payslips" ON storage.objects FOR SELECT
  USING (bucket_id = 'payslips' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own payslips" ON storage.objects FOR UPDATE
  USING (bucket_id = 'payslips' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own payslips" ON storage.objects FOR DELETE
  USING (bucket_id = 'payslips' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Indexes for performance
CREATE INDEX idx_payslips_user_id ON public.payslips(user_id);
CREATE INDEX idx_payslips_pay_date ON public.payslips(pay_date DESC);
CREATE INDEX idx_anomaly_results_payslip_id ON public.anomaly_results(payslip_id);
CREATE INDEX idx_payslip_extractions_payslip_id ON public.payslip_extractions(payslip_id);
CREATE INDEX idx_issue_drafts_user_id ON public.issue_drafts(user_id);
CREATE INDEX idx_audit_events_user_id ON public.audit_events(user_id);
