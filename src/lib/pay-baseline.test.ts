import { describe, expect, it } from 'vitest';
import type { Payslip } from './types';
import { deriveUsualPayBaseline } from './pay-baseline';

function payslip(overrides: Partial<Payslip>): Payslip {
  return {
    id: 'slip',
    employer_name: 'Acme Ltd',
    file_name: 'payslip.pdf',
    pay_date: '2026-01-31',
    pay_period_start: '2026-01-01',
    pay_period_end: '2026-01-31',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 3500,
    net_pay: 2500,
    tax_amount: 500,
    total_deductions: 1000,
    anomaly_count: 0,
    ...overrides,
  };
}

describe('deriveUsualPayBaseline', () => {
  it('uses the median of the last three comparable confirmed payslips', () => {
    const result = deriveUsualPayBaseline([
      payslip({ id: 'jan', pay_date: '2026-01-31', net_pay: 2500 }),
      payslip({ id: 'feb', pay_date: '2026-02-28', pay_period_start: '2026-02-01', pay_period_end: '2026-02-28', net_pay: 2600 }),
      payslip({ id: 'mar', pay_date: '2026-03-31', pay_period_start: '2026-03-01', pay_period_end: '2026-03-31', net_pay: 10000 }),
      payslip({ id: 'apr', pay_date: '2026-04-30', pay_period_start: '2026-04-01', pay_period_end: '2026-04-30', net_pay: 2450 }),
    ]);

    expect(result).toEqual({
      status: 'ready',
      currentPayslipId: 'apr',
      referencePayslipId: 'mar',
      sampleSize: 3,
      usualNetPay: 2600,
      netDifference: -150,
    });
  });

  it('uses only confirmed payslips from the same country, employer, and cadence', () => {
    const result = deriveUsualPayBaseline([
      payslip({ id: 'jan', pay_date: '2026-01-31', net_pay: 2500 }),
      payslip({ id: 'feb', pay_date: '2026-02-28', pay_period_start: '2026-02-01', pay_period_end: '2026-02-28', net_pay: 2600 }),
      payslip({ id: 'review', pay_date: '2026-03-31', pay_period_start: '2026-03-01', pay_period_end: '2026-03-31', net_pay: 9999, status: 'extracted' }),
      payslip({ id: 'ireland', pay_date: '2026-03-31', pay_period_start: '2026-03-01', pay_period_end: '2026-03-31', net_pay: 9999, country: 'Ireland' }),
      payslip({ id: 'other-employer', pay_date: '2026-03-31', pay_period_start: '2026-03-01', pay_period_end: '2026-03-31', net_pay: 9999, employer_name: 'Other Ltd' }),
      payslip({ id: 'weekly', pay_date: '2026-04-07', pay_period_start: '2026-04-01', pay_period_end: '2026-04-07', net_pay: 9999 }),
      payslip({ id: 'apr', pay_date: '2026-04-30', pay_period_start: '2026-04-01', pay_period_end: '2026-04-30', net_pay: 2450 }),
    ]);

    expect(result).toMatchObject({
      status: 'ready',
      currentPayslipId: 'apr',
      referencePayslipId: 'feb',
      sampleSize: 2,
      usualNetPay: 2550,
      netDifference: -100,
    });
  });

  it('waits until there are two comparable previous payslips', () => {
    const result = deriveUsualPayBaseline([
      payslip({ id: 'jan', pay_date: '2026-01-31' }),
      payslip({ id: 'feb', pay_date: '2026-02-28', pay_period_start: '2026-02-01', pay_period_end: '2026-02-28' }),
    ]);

    expect(result).toEqual({
      status: 'needs_history',
      currentPayslipId: 'feb',
      referencePayslipId: 'jan',
      sampleSize: 1,
      usualNetPay: null,
      netDifference: null,
    });
  });

  it('does not reorder or mutate the payslip list supplied by the dashboard', () => {
    const input = [
      payslip({ id: 'mar', pay_date: '2026-03-31', pay_period_start: '2026-03-01', pay_period_end: '2026-03-31' }),
      payslip({ id: 'jan', pay_date: '2026-01-31' }),
      payslip({ id: 'feb', pay_date: '2026-02-28', pay_period_start: '2026-02-01', pay_period_end: '2026-02-28' }),
    ];

    deriveUsualPayBaseline(input);

    expect(input.map(({ id }) => id)).toEqual(['mar', 'jan', 'feb']);
  });
});
