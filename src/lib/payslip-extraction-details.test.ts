import { describe, expect, it } from 'vitest';
import { normalizeExtractionDetails } from './payslip-extraction-details';

describe('payslip extraction detail hydration', () => {
  it('keeps useful non-identifying payroll context bounded', () => {
    expect(normalizeExtractionDetails({
      normalized_json: {
        document_context: {
          tax_code: '1257L',
          national_insurance_category: 'A',
          prsi_class: null,
          pay_frequency: 'monthly',
          pay_basis: 'Salary',
        },
      },
    }).extraction_context).toEqual({
      tax_code: '1257L',
      national_insurance_category: 'A',
      prsi_class: null,
      pay_frequency: 'monthly',
      pay_basis: 'Salary',
    });
  });

  it('does not hydrate an unsupported frequency', () => {
    expect(normalizeExtractionDetails({
      normalized_json: {
        document_context: {
          tax_code: '1257L',
          national_insurance_category: 'A',
          prsi_class: null,
          pay_frequency: 'unknown',
          pay_basis: 'Salary',
        },
      },
    }).extraction_context).toBeUndefined();
  });

  it('does not hydrate overlong context values', () => {
    expect(normalizeExtractionDetails({
      normalized_json: {
        document_context: {
          tax_code: 'x'.repeat(41),
          national_insurance_category: 'A',
          prsi_class: null,
          pay_frequency: 'monthly',
          pay_basis: 'Salary',
        },
      },
    }).extraction_context).toBeUndefined();
  });
});
