import { describe, expect, it } from 'vitest';
import {
  comparisonRowsFor,
  deductionChangesFor,
  selectPayslipComparison,
} from './payslip-comparison';
import type { Payslip } from './types';

function payslip(overrides: Partial<Payslip> = {}): Payslip {
  return {
    anomaly_count: 0,
    country: 'UK',
    employer_name: 'Example Ltd',
    file_name: 'payslip.pdf',
    gross_pay: 3_000,
    id: 'payslip',
    net_pay: 2_300,
    pay_date: '2026-03-31',
    pay_period_end: '2026-03-31',
    pay_period_start: '2026-03-01',
    status: 'confirmed',
    tax_amount: 400,
    total_deductions: 700,
    ...overrides,
  };
}

describe('selectPayslipComparison', () => {
  it('uses two compatible confirmed payslips and skips extracted records by default', () => {
    const result = selectPayslipComparison([
      payslip({ id: 'uk-jan', pay_date: '2026-01-31' }),
      payslip({ id: 'ireland-feb', country: 'Ireland', pay_date: '2026-02-28' }),
      payslip({ id: 'review-apr', pay_date: '2026-04-30', status: 'extracted' }),
      payslip({ id: 'uk-mar', pay_date: '2026-03-31' }),
    ], null, null);

    expect(result.issue).toBeNull();
    expect(result.comparison?.current.id).toBe('uk-mar');
    expect(result.comparison?.previous.id).toBe('uk-jan');
  });

  it('does not silently replace a selected payslip that still needs review', () => {
    const result = selectPayslipComparison([
      payslip({ id: 'confirmed-jan', pay_date: '2026-01-31' }),
      payslip({ id: 'review-feb', pay_date: '2026-02-28', status: 'extracted' }),
    ], 'review-feb', 'confirmed-jan');

    expect(result).toEqual({ comparison: null, issue: 'needs_review' });
  });

  it('rejects selected records from different country payroll systems', () => {
    const result = selectPayslipComparison([
      payslip({ id: 'uk-mar', country: 'UK', pay_date: '2026-03-31' }),
      payslip({ id: 'ireland-feb', country: 'Ireland', pay_date: '2026-02-28' }),
    ], 'uk-mar', 'ireland-feb');

    expect(result).toEqual({ comparison: null, issue: 'country_mismatch' });
  });

  it('requires the previous selection to actually precede the current one', () => {
    const result = selectPayslipComparison([
      payslip({ id: 'uk-mar', pay_date: '2026-03-31' }),
      payslip({ id: 'uk-apr', pay_date: '2026-04-30' }),
    ], 'uk-mar', 'uk-apr');

    expect(result).toEqual({ comparison: null, issue: 'invalid_order' });
  });
});

describe('country-aware comparison rows', () => {
  it('uses PRSI and USC labels for Irish payslips, not National Insurance', () => {
    const previous = payslip({
      country: 'Ireland',
      id: 'ireland-jan',
      pay_date: '2026-01-31',
      ni_amount: 999,
      pension_amount: 100,
      prsi_amount: 120,
      usc_amount: 40,
    });
    const current = payslip({
      country: 'Ireland',
      id: 'ireland-feb',
      pay_date: '2026-02-28',
      ni_amount: 999,
      pension_amount: 100,
      prsi_amount: 130,
      usc_amount: 45,
    });

    expect(comparisonRowsFor(current, previous).map((row) => row.label)).toEqual([
      'Gross pay',
      'PAYE',
      'PRSI',
      'USC',
      'Pension',
      'Total deductions',
      'Net pay',
    ]);
    expect(deductionChangesFor(current, previous)).toEqual([
      { label: 'PRSI', current: 130, previous: 120 },
      { label: 'USC', current: 45, previous: 40 },
    ]);
  });

  it('keeps an unavailable optional deduction unknown instead of replacing it with zero', () => {
    const previous = payslip({ id: 'uk-jan', pay_date: '2026-01-31', ni_amount: 100 });
    const current = payslip({ id: 'uk-feb', pay_date: '2026-02-28' });

    const nationalInsurance = comparisonRowsFor(current, previous).find((row) => row.label === 'National Insurance');

    expect(nationalInsurance).toMatchObject({ previous: 100, current: null });
  });
});
