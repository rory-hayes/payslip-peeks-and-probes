import { describe, expect, it } from 'vitest';

import {
  runReviewedLineItemChecks,
  storedReviewedLineItems,
  withReviewedDerivedAmounts,
} from '../../supabase/functions/_shared/reviewed-anomaly-line-items.ts';
import type { Extraction } from '../../supabase/functions/_shared/payslip-extraction.ts';

const emptyExtraction: Extraction = {
  gross_pay: 3_000,
  net_pay: 2_300,
  taxable_pay: null,
  tax_amount: 400,
  national_insurance_amount: 150,
  prsi_amount: null,
  usc_amount: null,
  social_security_amount: null,
  solidarity_amount: null,
  church_tax_amount: null,
  pension_amount: 100,
  student_loan_amount: 999,
  bonus_amount: 999,
  overtime_amount: 999,
  total_deductions: 700,
};

describe('reviewed line-item issue checks', () => {
  it('accepts only fully reviewed and bounded line items', () => {
    expect(storedReviewedLineItems({
      normalized_json: {
        line_items: [{ label: 'Cycle to Work', kind: 'deduction', amount: 35, reviewed: true }],
      },
    })).toEqual([{ label: 'Cycle to Work', kind: 'deduction', amount: 35 }]);

    expect(storedReviewedLineItems({
      normalized_json: {
        line_items: [{ label: 'Cycle to Work', kind: 'deduction', amount: 35 }],
      },
    })).toBeNull();
    expect(storedReviewedLineItems({
      normalized_json: {
        line_items: [{ label: 'Cycle to Work', kind: 'deduction', amount: -1, reviewed: true }],
      },
    })).toBeNull();
  });

  it('replaces unreviewed specialist scalars with totals derived from reviewed rows', () => {
    expect(withReviewedDerivedAmounts(emptyExtraction, [
      { label: 'Quarterly bonus', kind: 'earning', amount: 250 },
      { label: 'Overtime', kind: 'earning', amount: 80 },
      { label: 'Student Loan Plan 2', kind: 'deduction', amount: 45 },
    ])).toMatchObject({
      bonus_amount: 250,
      overtime_amount: 80,
      student_loan_amount: 45,
    });

    expect(withReviewedDerivedAmounts(emptyExtraction, null)).toMatchObject({
      bonus_amount: null,
      overtime_amount: null,
      student_loan_amount: null,
    });
  });

  it('groups new, removed, and meaningfully changed non-statutory deductions', () => {
    const checks = runReviewedLineItemChecks(
      [
        { label: 'Income tax', kind: 'deduction', amount: 500 },
        { label: 'Cycle to Work', kind: 'deduction', amount: 45 },
        { label: 'Health cover', kind: 'deduction', amount: 20 },
      ],
      [
        { label: 'Income tax', kind: 'deduction', amount: 450 },
        { label: 'Cycle to Work', kind: 'deduction', amount: 30 },
        { label: 'Union subscription', kind: 'deduction', amount: 12 },
      ],
      'UK',
      5,
    );

    expect(checks.map((check) => check.anomaly_type)).toEqual([
      'reviewed_deductions_added',
      'reviewed_deductions_removed',
      'reviewed_deductions_changed',
    ]);
    expect(checks[0].description).toContain('Health cover (£20.00)');
    expect(checks[1].description).toContain('Union subscription (£12.00)');
    expect(checks[2].description).toContain('Cycle to Work changed from £30.00 to £45.00');
    expect(checks.some((check) => check.description.includes('Income tax'))).toBe(false);
  });

  it('does not invent comparisons without two reviewed line-item sets', () => {
    expect(runReviewedLineItemChecks([], null, 'Ireland', 5)).toEqual([]);
    expect(runReviewedLineItemChecks(
      [{ label: 'Cycle to Work', kind: 'deduction', amount: 31 }],
      [{ label: 'Cycle to Work', kind: 'deduction', amount: 30 }],
      'Ireland',
      5,
    )).toEqual([]);
  });
});
