import { describe, expect, it } from 'vitest';
import { parseExtraction } from '../../supabase/functions/_shared/payslip-extraction.ts';

function validExtraction(overrides: Record<string, unknown> = {}) {
  return {
    pay_date: '2026-03-31',
    pay_period_start: '2026-03-01',
    pay_period_end: '2026-03-31',
    employer_name: 'Example Ltd',
    country: 'UK',
    currency: 'GBP',
    document_context: {
      tax_code: '1257L',
      national_insurance_category: 'A',
      prsi_class: null,
      pay_frequency: 'monthly',
      pay_basis: 'Salary',
    },
    gross_pay: 3000,
    net_pay: 2300,
    taxable_pay: 3000,
    tax_amount: 400,
    national_insurance_amount: 200,
    prsi_amount: null,
    usc_amount: null,
    social_security_amount: null,
    solidarity_amount: null,
    church_tax_amount: null,
    pension_amount: 100,
    student_loan_amount: null,
    bonus_amount: null,
    overtime_amount: null,
    total_deductions: 700,
    year_to_date: { gross_pay: 9000, tax: 1200, ni: 600, pension: 300 },
    line_items: [{
      label: 'Basic pay',
      kind: 'earning',
      amount: 3000,
      year_to_date_amount: 9000,
      evidence: 'Basic pay £3,000.00',
      confidence: 'high',
    }],
    field_evidence: [{
      field: 'gross_pay',
      evidence: 'Gross pay £3,000.00',
      confidence: 'high',
    }],
    confidence: 'high',
    ...overrides,
  };
}

describe('payslip extraction parser', () => {
  it('keeps bounded line items, year-to-date values, and source evidence', () => {
    const parsed = parseExtraction(validExtraction());

    expect(parsed).toMatchObject({
      currency: 'GBP',
      document_context: { tax_code: '1257L', pay_frequency: 'monthly' },
      line_items: [{ label: 'Basic pay', amount: 3000, evidence: 'Basic pay £3,000.00' }],
      field_evidence: [{ field: 'gross_pay', confidence: 'high' }],
      year_to_date: { gross_pay: 9000, tax: 1200 },
    });
  });

  it('rejects malformed line items instead of persisting unbounded provider output', () => {
    expect(parseExtraction(validExtraction({
      line_items: [{
        label: 'Basic pay',
        kind: 'unknown',
        amount: 3000,
        year_to_date_amount: null,
        evidence: null,
        confidence: 'high',
      }],
    }))).toBeNull();

    expect(parseExtraction(validExtraction({
      field_evidence: [{ field: 'gross_pay', evidence: 'x'.repeat(301), confidence: 'high' }],
    }))).toBeNull();
  });

  it('rejects an extraction that exceeds the line-item cap', () => {
    const lineItems = Array.from({ length: 61 }, (_, index) => ({
      label: `Item ${index}`,
      kind: 'deduction',
      amount: 1,
      year_to_date_amount: null,
      evidence: 'Item £1.00',
      confidence: 'low',
    }));

    expect(parseExtraction(validExtraction({ line_items: lineItems }))).toBeNull();
  });

  it('rejects guessed or unsupported payroll context values', () => {
    expect(parseExtraction(validExtraction({
      document_context: {
        tax_code: '1257L',
        national_insurance_category: 'A',
        prsi_class: null,
        pay_frequency: 'every-other-week',
        pay_basis: 'Salary',
      },
    }))).toBeNull();
  });
});
