-- Tenant-owned joins and deletion cascades must not degrade into full-table
-- scans as a customer's pay history grows. PostgreSQL does not create indexes
-- for foreign-key columns automatically, so cover every application-owned FK
-- that is not already the leading column of an existing index.

CREATE INDEX IF NOT EXISTS account_deletion_billing_reviews_deletion_job_idx
  ON public.account_deletion_billing_reviews (deletion_job_id);

CREATE INDEX IF NOT EXISTS employers_user_idx
  ON public.employers (user_id);

CREATE INDEX IF NOT EXISTS issue_drafts_employer_idx
  ON public.issue_drafts (employer_id);

CREATE INDEX IF NOT EXISTS issue_drafts_payslip_idx
  ON public.issue_drafts (payslip_id);

CREATE INDEX IF NOT EXISTS payday_plans_payslip_idx
  ON public.payday_plans (payslip_id);

CREATE INDEX IF NOT EXISTS payslip_original_link_leases_payslip_idx
  ON public.payslip_original_link_leases (payslip_id);

CREATE INDEX IF NOT EXISTS payslips_employer_idx
  ON public.payslips (employer_id);

CREATE INDEX IF NOT EXISTS user_notes_anomaly_idx
  ON public.user_notes (anomaly_id);

CREATE INDEX IF NOT EXISTS user_notes_payslip_idx
  ON public.user_notes (payslip_id);

CREATE INDEX IF NOT EXISTS user_notes_user_idx
  ON public.user_notes (user_id);
