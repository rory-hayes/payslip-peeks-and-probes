import { describe, expect, it } from 'vitest';
import {
  createReviewDocumentContextDraft,
  createReviewYearToDateDraft,
  validateReviewDocumentContext,
  validateReviewYearToDate,
} from './payslip-review-supporting-details';

describe('payslip supporting-detail review', () => {
  it('converts corrected year-to-date values to bounded money', () => {
    const draft = createReviewYearToDateDraft({ gross_pay: 9000, tax: 1200, ni: 600, pension: 300 });
    expect(draft).not.toBeNull();
    draft!.tax = '1,250.50';

    expect(validateReviewYearToDate(draft)).toEqual({
      yearToDate: { gross_pay: 9000, tax: 1250.5, ni: 600, pension: 300 },
      errors: {},
    });
  });

  it('rejects negative and unbounded cumulative values', () => {
    expect(validateReviewYearToDate({
      grossPay: '-1',
      tax: '10000001',
      ni: '',
      pension: '',
    })).toEqual({
      yearToDate: null,
      errors: {
        grossPay: 'Enter a value from 0 to 10,000,000, or leave it blank.',
        tax: 'Enter a value from 0 to 10,000,000, or leave it blank.',
      },
    });
  });

  it('trims reviewed payroll context and keeps the allowed pay frequency', () => {
    const draft = createReviewDocumentContextDraft({
      tax_code: ' 1257L ',
      national_insurance_category: 'A',
      prsi_class: null,
      pay_frequency: 'monthly',
      pay_basis: 'Salary',
    });

    expect(validateReviewDocumentContext(draft)).toEqual({
      documentContext: {
        tax_code: '1257L',
        national_insurance_category: 'A',
        prsi_class: null,
        pay_frequency: 'monthly',
        pay_basis: 'Salary',
      },
      errors: {},
    });
  });
});
