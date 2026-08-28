import type {
  PayslipExtractionConfidence,
  PayslipLineItem,
  PayslipLineItemKind,
} from './types';

const MAX_REVIEW_LINE_ITEMS = 60;
const MAX_REVIEW_LINE_ITEM_AMOUNT = 10_000_000;

export const REVIEW_LINE_ITEM_KINDS: ReadonlyArray<{
  value: PayslipLineItemKind;
  label: string;
}> = [
  { value: 'earning', label: 'Earning' },
  { value: 'deduction', label: 'Deduction' },
  { value: 'employer_contribution', label: 'Employer contribution' },
  { value: 'information', label: 'Information only' },
];

export interface ReviewLineItemDraft {
  id: string;
  sourceIndex: number | null;
  label: string;
  kind: PayslipLineItemKind;
  amount: string;
  yearToDateAmount: string;
  evidence: string | null;
  confidence: PayslipExtractionConfidence;
  editing: boolean;
}

export interface ConfirmedReviewLineItem {
  source_index: number | null;
  label: string;
  kind: PayslipLineItemKind;
  amount: number | null;
  year_to_date_amount: number | null;
}

export interface ReviewLineItemErrors {
  label?: string;
  amount?: string;
  yearToDateAmount?: string;
}

function moneyDraft(value: number | null): string {
  return value === null ? '' : String(value);
}

function parseMoney(value: string): number | null | undefined {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_REVIEW_LINE_ITEM_AMOUNT) return undefined;
  return parsed;
}

export function createReviewLineItemDrafts(lineItems: PayslipLineItem[]): ReviewLineItemDraft[] {
  return lineItems.slice(0, MAX_REVIEW_LINE_ITEMS).map((item, index) => ({
    id: `extracted-${index}`,
    sourceIndex: index,
    label: item.label,
    kind: item.kind,
    amount: moneyDraft(item.amount),
    yearToDateAmount: moneyDraft(item.year_to_date_amount),
    evidence: item.evidence,
    confidence: item.confidence,
    editing: false,
  }));
}

export function createBlankReviewLineItemDraft(id: string): ReviewLineItemDraft {
  return {
    id,
    sourceIndex: null,
    label: '',
    kind: 'earning',
    amount: '',
    yearToDateAmount: '',
    evidence: null,
    confidence: 'low',
    editing: true,
  };
}

export function validateReviewLineItems(lineItems: ReviewLineItemDraft[]): {
  lineItems: ConfirmedReviewLineItem[] | null;
  errors: Record<string, ReviewLineItemErrors>;
} {
  const errors: Record<string, ReviewLineItemErrors> = {};
  const confirmed: ConfirmedReviewLineItem[] = [];

  if (lineItems.length > MAX_REVIEW_LINE_ITEMS) {
    return {
      lineItems: null,
      errors: { _form: { label: `Keep the detailed review to ${MAX_REVIEW_LINE_ITEMS} rows or fewer.` } },
    };
  }

  for (const item of lineItems) {
    const itemErrors: ReviewLineItemErrors = {};
    const label = item.label.trim();
    const amount = parseMoney(item.amount);
    const yearToDateAmount = parseMoney(item.yearToDateAmount);

    if (!label) itemErrors.label = 'Add the description shown on the payslip.';
    else if (label.length > 120) itemErrors.label = 'Keep the description to 120 characters or fewer.';
    if (amount === undefined) itemErrors.amount = 'Enter a value from 0 to 10,000,000, or leave it blank.';
    if (yearToDateAmount === undefined) itemErrors.yearToDateAmount = 'Enter a value from 0 to 10,000,000, or leave it blank.';

    if (Object.keys(itemErrors).length > 0) {
      errors[item.id] = itemErrors;
      continue;
    }

    confirmed.push({
      source_index: item.sourceIndex,
      label,
      kind: item.kind,
      amount: amount ?? null,
      year_to_date_amount: yearToDateAmount ?? null,
    });
  }

  return {
    lineItems: Object.keys(errors).length === 0 ? confirmed : null,
    errors,
  };
}

export const REVIEW_LINE_ITEM_LIMIT = MAX_REVIEW_LINE_ITEMS;
