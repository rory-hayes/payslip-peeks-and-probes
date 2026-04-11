-- Allow users to delete their own profile
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own anomaly results
CREATE POLICY "Users can delete own anomalies"
ON public.anomaly_results
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM payslips
  WHERE payslips.id = anomaly_results.payslip_id
    AND payslips.user_id = auth.uid()
));

-- Allow users to delete their own billing subscription
CREATE POLICY "Users can delete own subscription"
ON public.billing_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own audit events
CREATE POLICY "Users can delete own audit events"
ON public.audit_events
FOR DELETE
USING (auth.uid() = user_id);

-- Make anomaly_results cascade on payslip deletion
ALTER TABLE public.anomaly_results
  DROP CONSTRAINT anomaly_results_payslip_id_fkey,
  ADD CONSTRAINT anomaly_results_payslip_id_fkey
    FOREIGN KEY (payslip_id) REFERENCES public.payslips(id) ON DELETE CASCADE;

-- Make payslip_extractions cascade on payslip deletion
ALTER TABLE public.payslip_extractions
  DROP CONSTRAINT payslip_extractions_payslip_id_fkey,
  ADD CONSTRAINT payslip_extractions_payslip_id_fkey
    FOREIGN KEY (payslip_id) REFERENCES public.payslips(id) ON DELETE CASCADE;