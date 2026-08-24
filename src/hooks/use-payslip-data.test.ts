import { describe, expect, it } from 'vitest';
import { normalizePayslipStatus, normalizeExtractionDetails } from './use-payslip-data';

describe('normalizePayslipStatus', () => {
  it('maps only a completed server lifecycle state to a confirmed client record', () => {
    expect(normalizePayslipStatus('completed')).toBe('confirmed');
    expect(normalizePayslipStatus('needs_review')).toBe('extracted');
    expect(normalizePayslipStatus('processing')).toBe('processing');
    expect(normalizePayslipStatus('unknown')).toBe('processing');
  });
});

describe('normalizeExtractionDetails', () => {
  it('hydrates safe line items, evidence, confidence, and year-to-date data from normalized JSON', () => {
    expect(normalizeExtractionDetails({
      confidence_score: 0.9,
      year_to_date_json: { gross_pay: 9000, tax: 1200, ni: 600, pension: 300 },
      normalized_json: {
        currency: 'GBP',
        confidence: 'high',
        line_items: [{
          label: 'Basic pay',
          kind: 'earning',
          amount: 3000,
          year_to_date_amount: 9000,
          evidence: 'Basic pay £3,000.00',
          confidence: 'high',
        }],
        field_evidence: [{ field: 'gross_pay', evidence: 'Gross pay £3,000.00', confidence: 'high' }],
      },
    })).toEqual({
      currency: 'GBP',
      extraction_confidence: 'high',
      extraction_line_items: [{
        label: 'Basic pay',
        kind: 'earning',
        amount: 3000,
        year_to_date_amount: 9000,
        evidence: 'Basic pay £3,000.00',
        confidence: 'high',
      }],
      extraction_field_evidence: [{ field: 'gross_pay', evidence: 'Gross pay £3,000.00', confidence: 'high' }],
      year_to_date: { gross_pay: 9000, tax: 1200, ni: 600, pension: 300 },
    });
  });
});
