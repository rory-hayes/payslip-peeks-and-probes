import { describe, expect, it } from 'vitest';
import {
  createBlankReviewLineItemDraft,
  createReviewLineItemDrafts,
  validateReviewLineItems,
} from './payslip-review-line-items';

describe('payslip review line items', () => {
  it('keeps a source reference while converting editable money to bounded numbers', () => {
    const [draft] = createReviewLineItemDrafts([{
      label: 'Basic pay',
      kind: 'earning',
      amount: 2200,
      year_to_date_amount: 6600,
      evidence: 'Basic pay £2,200.00',
      confidence: 'high',
    }]);
    draft.label = 'Basic salary';
    draft.amount = '2,250.50';

    expect(validateReviewLineItems([draft])).toEqual({
      lineItems: [{
        source_index: 0,
        label: 'Basic salary',
        kind: 'earning',
        amount: 2250.5,
        year_to_date_amount: 6600,
      }],
      errors: {},
    });
  });

  it('allows a reviewer to add a row with blank optional amounts', () => {
    const draft = createBlankReviewLineItemDraft('added-1');
    draft.label = 'Cycle to Work';
    draft.kind = 'deduction';

    expect(validateReviewLineItems([draft]).lineItems).toEqual([{
      source_index: null,
      label: 'Cycle to Work',
      kind: 'deduction',
      amount: null,
      year_to_date_amount: null,
    }]);
  });

  it('rejects missing labels, negative money, and unbounded values', () => {
    const draft = createBlankReviewLineItemDraft('added-2');
    draft.amount = '-1';
    draft.yearToDateAmount = '10000001';

    const result = validateReviewLineItems([draft]);
    expect(result.lineItems).toBeNull();
    expect(result.errors['added-2']).toEqual({
      label: 'Add the description shown on the payslip.',
      amount: 'Enter a value from 0 to 10,000,000, or leave it blank.',
      yearToDateAmount: 'Enter a value from 0 to 10,000,000, or leave it blank.',
    });
  });
});
