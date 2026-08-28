import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');

function source(path: string) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('two-check Free trial contract', () => {
  const migration = source('supabase/migrations/20260828150000_two_check_lifetime_free_trial.sql');

  it('enforces two lifetime Free checks and six monthly paid checks in both reservation paths', () => {
    expect(migration.match(/v_quota_limit integer := 2;/g)).toHaveLength(2);
    expect(migration.match(/v_quota_scope text := 'lifetime';/g)).toHaveLength(2);
    expect(migration.match(/v_quota_limit := 6;/g)).toHaveLength(2);
    expect(migration.match(/v_quota_scope := 'month';/g)).toHaveLength(2);
    expect(migration.match(/tier_at_reservation = 'free'/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('serialises quota decisions across calendar-month boundaries', () => {
    expect(migration.match(/:automatic-check-quota/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("processing_failure_code = 'automatic_check_limit'");
    expect(migration).toContain('v_retry_already_charged');
  });

  it('keeps Edge Function error handling compatible with the scoped quota response', () => {
    const startUpload = source('supabase/functions/start-payslip-upload/index.ts');
    const processPayslip = source('supabase/functions/process-payslip/index.ts');

    expect(startUpload).toContain('session.quota_scope === "lifetime"');
    expect(startUpload).toContain('automatic_check_limit_reached');
    expect(processPayslip).toContain('claim?.quota_scope === "lifetime"');
    expect(processPayslip).toContain('automatic_check_limit_reached');
  });
});
