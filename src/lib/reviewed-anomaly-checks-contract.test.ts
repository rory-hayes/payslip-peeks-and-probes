import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const migration = readFileSync(resolve(
  projectRoot,
  'supabase/migrations/20260828210000_reviewed_anomaly_checks.sql',
), 'utf8');
const processPayslip = readFileSync(resolve(
  projectRoot,
  'supabase/functions/process-payslip/index.ts',
), 'utf8');
const reviewedLineItemChecks = readFileSync(resolve(
  projectRoot,
  'supabase/functions/_shared/reviewed-anomaly-line-items.ts',
), 'utf8');
const upload = readFileSync(resolve(projectRoot, 'src/components/PayslipUpload.tsx'), 'utf8');
const payslipData = readFileSync(resolve(projectRoot, 'src/hooks/use-payslip-data.ts'), 'utf8');

describe('reviewed anomaly-check contract', () => {
  it('fences every confirmation with a new pending review-check revision', () => {
    expect(migration).toContain("review_checks_status = 'pending'");
    expect(migration).toContain('review_checks_revision := OLD.review_checks_revision + 1');
    expect(migration).toContain("WHERE status = 'completed'");
    expect(migration).toContain('prepare_reviewed_payslip_checks_before_confirmation');
    expect(migration).toContain('SET anomaly_threshold_percent = 5');
  });

  it('atomically replaces only the matching owner and revision result set', () => {
    expect(migration).toContain('replace_reviewed_payslip_anomalies');
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(migration).toContain('AND user_id = p_user_id');
    expect(migration).toContain('AND review_checks_revision = p_review_checks_revision');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('payslip_id = coalesce(payslip_id, locked_payslip_id)');
    expect(migration).toContain('anomaly_id = NULL');
    expect(migration).toContain('DELETE FROM public.anomaly_results');
    expect(migration).toContain("review_checks_status = 'complete'");
    expect(migration).toContain('jsonb_array_length(p_anomalies) > 40');
  });

  it('runs checks only from reviewed data and the nearest earlier confirmed pay period', () => {
    expect(processPayslip).toContain('requestBody.mode === "reviewed_checks"');
    expect(processPayslip).toContain('.eq("status", "completed")');
    expect(processPayslip).toContain('.lt("pay_date", payslip.pay_date)');
    expect(processPayslip).toContain('replace_reviewed_payslip_anomalies');
    expect(processPayslip).toContain('checks_pending: true');
    expect(processPayslip).toContain('runReviewedLineItemChecks(currentLineItems, previousLineItems');
    expect(reviewedLineItemChecks).toContain('candidate.reviewed !== true');
    expect(reviewedLineItemChecks).toContain('reviewed_deductions_added');
    expect(reviewedLineItemChecks).toContain('reviewed_deductions_changed');
    expect(processPayslip).not.toContain('.in("status", ["completed", "needs_review"])');
  });

  it('refreshes after confirmation and hides results from older revisions', () => {
    expect(upload).toContain("mode: 'reviewed_checks'");
    expect(upload.indexOf("supabase.rpc('confirm_payslip_review'")).toBeLessThan(
      upload.indexOf("mode: 'reviewed_checks'"),
    );
    expect(payslipData).toContain("payslipChecks?.status === 'complete'");
    expect(payslipData).toContain('Number(a.review_checks_revision) === payslipChecks.revision');
    expect(payslipData).toContain("payslipWithChecks?.review_checks_status !== 'complete'");
  });
});
