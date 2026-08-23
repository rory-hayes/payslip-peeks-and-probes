import { describe, expect, it } from 'vitest';
import { buildPayHistoryComparison, confirmedPayslipAmount, currencyForPayslip, findPreviousSameCountryConfirmedPayslip } from './pay-history';
import type { ConfirmedPayslip } from '../types/models';

function payslip(overrides: Partial<ConfirmedPayslip> = {}): ConfirmedPayslip {
  return {
    id: 'payslip',
    employer_id: null,
    file_path: null,
    file_name: 'payslip.pdf',
    pay_date: '2026-04-30',
    pay_period_end: '2026-04-30',
    pay_period_start: '2026-04-01',
    country: 'UK',
    status: 'completed',
    processing_failure_code: null,
    cleanup_requested_at: null,
    created_at: '2026-04-30T12:00:00.000Z',
    extraction: {
      payslip_id: 'payslip',
      extraction_status: 'completed',
      confidence_score: null,
      gross_pay: 3000,
      net_pay: 2400,
      taxable_pay: null,
      tax_amount: 400,
      national_insurance_amount: 120,
      prsi_amount: null,
      usc_amount: null,
      pension_amount: 80,
      total_deductions: 600,
    },
    ...overrides,
  };
}

describe('pay history comparison', () => {
  it('selects the closest earlier confirmed payslip from the same country even when history is not ordered', () => {
    const current = payslip({ id: 'apr' });
    const result = findPreviousSameCountryConfirmedPayslip(current, [
      payslip({ id: 'jan', pay_date: '2026-01-31' }),
      current,
      payslip({ id: 'mar', pay_date: '2026-03-31' }),
      payslip({ id: 'may', pay_date: '2026-05-31' }),
      payslip({ id: 'ireland', country: 'Ireland', pay_date: '2026-03-31' }),
      payslip({ id: 'unconfirmed', pay_date: '2026-03-30', status: 'needs_review' }),
    ]);

    expect(result?.id).toBe('mar');
  });

  it('does not create a comparison when the current country or date is unavailable', () => {
    const prior = payslip({ id: 'prior', pay_date: '2026-03-31' });
    expect(findPreviousSameCountryConfirmedPayslip(payslip({ country: null }), [prior])).toBeNull();
    expect(findPreviousSameCountryConfirmedPayslip(payslip({ pay_date: null }), [prior])).toBeNull();
    expect(findPreviousSameCountryConfirmedPayslip(payslip({ pay_date: '2026-02-30' }), [prior])).toBeNull();
  });

  it('keeps missing figures unavailable rather than treating them as zero and calculates known changes exactly', () => {
    const current = payslip({
      id: 'apr',
      extraction: { ...payslip().extraction!, payslip_id: 'apr', gross_pay: '3,100', net_pay: 2450, total_deductions: null },
    });
    const previous = payslip({
      id: 'mar',
      pay_date: '2026-03-31',
      extraction: { ...payslip().extraction!, payslip_id: 'mar', gross_pay: 3000, net_pay: 2400, total_deductions: 600 },
    });

    const comparison = buildPayHistoryComparison(current, [current, previous]);
    expect(comparison.previousPayslip?.id).toBe('mar');
    expect(comparison.metrics.find((metric) => metric.id === 'net_pay')).toMatchObject({ current: 2450, previous: 2400, difference: 50 });
    expect(comparison.metrics.find((metric) => metric.id === 'gross_pay')).toMatchObject({ current: null, previous: 3000, difference: null });
    expect(comparison.metrics.find((metric) => metric.id === 'total_deductions')).toMatchObject({ current: null, previous: 600, difference: null });
    expect(confirmedPayslipAmount(current, 'gross_pay')).toBeNull();
  });

  it('uses the payslip country for currency presentation rather than a current-profile fallback', () => {
    expect(currencyForPayslip('Ireland', 'GBP')).toBe('EUR');
    expect(currencyForPayslip('UK', 'EUR')).toBe('GBP');
    expect(currencyForPayslip(null, 'EUR')).toBe('EUR');
  });
});
