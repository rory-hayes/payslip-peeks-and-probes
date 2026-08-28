import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const migration = readFileSync(resolve(
  projectRoot,
  'supabase/migrations/20260828200000_confirm_review_supporting_details.sql',
), 'utf8');

describe('reviewed supporting-detail persistence contract', () => {
  it('keeps the prior line-item contract internal and exposes one compatible review function', () => {
    expect(migration).toContain('RENAME TO confirm_payslip_review_core');
    expect(migration).toContain('FROM PUBLIC, authenticated');
    expect(migration).toContain('p_year_to_date jsonb DEFAULT NULL');
    expect(migration).toContain('p_document_context jsonb DEFAULT NULL');
    expect(migration).toContain('PERFORM public.confirm_payslip_review_core');
  });

  it('bounds cumulative money and payroll context on the server', () => {
    expect(migration).toContain('reviewed_gross_ytd > 10000000');
    expect(migration).toContain("reviewed_pay_frequency NOT IN ('weekly', 'fortnightly', 'four_weekly', 'monthly', 'annual', 'other')");
    expect(migration).toContain("char_length(coalesce(reviewed_tax_code, '')) > 40");
    expect(migration).toContain("char_length(coalesce(reviewed_ni_category, '')) > 20");
  });

  it('updates both hydrated YTD storage and reviewed markers in the same transaction', () => {
    expect(migration).toContain('year_to_date_json = CASE');
    expect(migration).toContain("'{year_to_date_reviewed}'");
    expect(migration).toContain("'{document_context_reviewed}'");
    expect(migration).toContain('FOR UPDATE');
  });
});
