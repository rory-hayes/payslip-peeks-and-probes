import { describe, expect, it } from 'vitest';
import { deriveUsualPayBaseline } from './usual-pay';
import type { ConfirmedPayslip } from '../types/models';

function payslip(overrides: Partial<ConfirmedPayslip> = {}): ConfirmedPayslip {
  return {
    id: 'payslip',
    employer_id: 'employer-a',
    file_path: null,
    file_name: 'payslip.pdf',
    pay_date: '2026-01-31',
    pay_period_end: '2026-01-31',
    pay_period_start: '2026-01-01',
    country: 'UK',
    status: 'completed',
    processing_failure_code: null,
    cleanup_requested_at: null,
    created_at: '2026-01-31T12:00:00.000Z',
    extraction: {
      payslip_id: 'payslip',
      extraction_status: 'completed',
      confidence_score: null,
      gross_pay: 3500,
      net_pay: 2500,
      taxable_pay: null,
      tax_amount: 500,
      national_insurance_amount: null,
      prsi_amount: null,
      usc_amount: null,
      pension_amount: null,
      total_deductions: 1000,
    },
    ...overrides,
  };
}

describe('deriveUsualPayBaseline', () => {
  it('uses the median of up to three comparable confirmed payslips', () => {
    const result = deriveUsualPayBaseline([
      payslip({ id: 'jan', pay_date: '2026-01-31' }),
      payslip({ id: 'feb', pay_date: '2026-02-28', pay_period_start: '2026-02-01', pay_period_end: '2026-02-28', extraction: { ...payslip().extraction!, payslip_id: 'feb', net_pay: 2600 } }),
      payslip({ id: 'mar', pay_date: '2026-03-31', pay_period_start: '2026-03-01', pay_period_end: '2026-03-31', extraction: { ...payslip().extraction!, payslip_id: 'mar', net_pay: 10000 } }),
      payslip({ id: 'apr', pay_date: '2026-04-30', pay_period_start: '2026-04-01', pay_period_end: '2026-04-30', extraction: { ...payslip().extraction!, payslip_id: 'apr', net_pay: 2450 } }),
    ]);

    expect(result).toEqual({
      status: 'ready',
      currentPayslipId: 'apr',
      sampleSize: 3,
      usualNetPay: 2600,
      netDifference: -150,
    });
  });

  it('excludes records that were not confirmed, do not match country or cadence, or have a known different employer', () => {
    const result = deriveUsualPayBaseline([
      payslip({ id: 'jan', pay_date: '2026-01-31' }),
      payslip({ id: 'feb', pay_date: '2026-02-28', pay_period_start: '2026-02-01', pay_period_end: '2026-02-28', extraction: { ...payslip().extraction!, payslip_id: 'feb', net_pay: 2600 } }),
      payslip({ id: 'review', pay_date: '2026-03-31', status: 'needs_review', pay_period_start: '2026-03-01', pay_period_end: '2026-03-31', extraction: { ...payslip().extraction!, payslip_id: 'review', net_pay: 9999 } }),
      payslip({ id: 'ireland', pay_date: '2026-03-31', country: 'Ireland', pay_period_start: '2026-03-01', pay_period_end: '2026-03-31', extraction: { ...payslip().extraction!, payslip_id: 'ireland', net_pay: 9999 } }),
      payslip({ id: 'other-employer', pay_date: '2026-03-31', employer_id: 'employer-b', pay_period_start: '2026-03-01', pay_period_end: '2026-03-31', extraction: { ...payslip().extraction!, payslip_id: 'other-employer', net_pay: 9999 } }),
      payslip({ id: 'weekly', pay_date: '2026-04-07', pay_period_start: '2026-04-01', pay_period_end: '2026-04-07', extraction: { ...payslip().extraction!, payslip_id: 'weekly', net_pay: 9999 } }),
      payslip({ id: 'apr', pay_date: '2026-04-30', pay_period_start: '2026-04-01', pay_period_end: '2026-04-30', extraction: { ...payslip().extraction!, payslip_id: 'apr', net_pay: 2450 } }),
    ]);

    expect(result).toEqual({
      status: 'ready',
      currentPayslipId: 'apr',
      sampleSize: 2,
      usualNetPay: 2550,
      netDifference: -100,
    });
  });

  it('keeps the usual-pay insight in its explicit history-building state until two prior comparable records exist', () => {
    const result = deriveUsualPayBaseline([
      payslip({ id: 'jan', pay_date: '2026-01-31' }),
      payslip({ id: 'feb', pay_date: '2026-02-28', pay_period_start: '2026-02-01', pay_period_end: '2026-02-28', extraction: { ...payslip().extraction!, payslip_id: 'feb', net_pay: 2600 } }),
    ]);

    expect(result).toEqual({
      status: 'needs_history',
      currentPayslipId: 'feb',
      sampleSize: 1,
      usualNetPay: null,
      netDifference: null,
    });
  });
});
