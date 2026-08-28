import type { PayslipExtractionContext, PayslipYearToDate } from './types';

const MAX_REVIEW_MONEY = 10_000_000;

export interface ReviewYearToDateDraft {
  grossPay: string;
  tax: string;
  ni: string;
  pension: string;
}

export interface ConfirmedYearToDate {
  gross_pay: number | null;
  tax: number | null;
  ni: number | null;
  pension: number | null;
}

export type ReviewYearToDateField = keyof ReviewYearToDateDraft;

export interface ReviewDocumentContextDraft {
  taxCode: string;
  nationalInsuranceCategory: string;
  prsiClass: string;
  payFrequency: NonNullable<PayslipExtractionContext['pay_frequency']> | '';
  payBasis: string;
}

export interface ConfirmedDocumentContext {
  tax_code: string | null;
  national_insurance_category: string | null;
  prsi_class: string | null;
  pay_frequency: PayslipExtractionContext['pay_frequency'];
  pay_basis: string | null;
}

export type ReviewDocumentContextField = keyof ReviewDocumentContextDraft;

function moneyDraft(value: number | null): string {
  return value === null ? '' : String(value);
}

function parseMoney(value: string): number | null | undefined {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_REVIEW_MONEY) return undefined;
  return parsed;
}

function optionalText(value: string): string | null {
  return value.trim() || null;
}

export function createReviewYearToDateDraft(value: PayslipYearToDate | undefined): ReviewYearToDateDraft | null {
  if (!value) return null;
  return {
    grossPay: moneyDraft(value.gross_pay),
    tax: moneyDraft(value.tax),
    ni: moneyDraft(value.ni),
    pension: moneyDraft(value.pension),
  };
}

export function validateReviewYearToDate(value: ReviewYearToDateDraft | null): {
  yearToDate: ConfirmedYearToDate | null;
  errors: Partial<Record<ReviewYearToDateField, string>>;
} {
  if (!value) return { yearToDate: null, errors: {} };

  const parsed = {
    grossPay: parseMoney(value.grossPay),
    tax: parseMoney(value.tax),
    ni: parseMoney(value.ni),
    pension: parseMoney(value.pension),
  };
  const errors: Partial<Record<ReviewYearToDateField, string>> = {};
  for (const [key, amount] of Object.entries(parsed) as Array<[ReviewYearToDateField, number | null | undefined]>) {
    if (amount === undefined) errors[key] = 'Enter a value from 0 to 10,000,000, or leave it blank.';
  }

  return {
    yearToDate: Object.keys(errors).length === 0 ? {
      gross_pay: parsed.grossPay ?? null,
      tax: parsed.tax ?? null,
      ni: parsed.ni ?? null,
      pension: parsed.pension ?? null,
    } : null,
    errors,
  };
}

export function createReviewDocumentContextDraft(value: PayslipExtractionContext | undefined): ReviewDocumentContextDraft | null {
  if (!value) return null;
  return {
    taxCode: value.tax_code ?? '',
    nationalInsuranceCategory: value.national_insurance_category ?? '',
    prsiClass: value.prsi_class ?? '',
    payFrequency: value.pay_frequency ?? '',
    payBasis: value.pay_basis ?? '',
  };
}

export function validateReviewDocumentContext(value: ReviewDocumentContextDraft | null): {
  documentContext: ConfirmedDocumentContext | null;
  errors: Partial<Record<ReviewDocumentContextField, string>>;
} {
  if (!value) return { documentContext: null, errors: {} };

  const errors: Partial<Record<ReviewDocumentContextField, string>> = {};
  if (value.taxCode.trim().length > 40) errors.taxCode = 'Keep the tax code to 40 characters or fewer.';
  if (value.nationalInsuranceCategory.trim().length > 20) {
    errors.nationalInsuranceCategory = 'Keep the NI category to 20 characters or fewer.';
  }
  if (value.prsiClass.trim().length > 20) errors.prsiClass = 'Keep the PRSI class to 20 characters or fewer.';
  if (value.payBasis.trim().length > 40) errors.payBasis = 'Keep the pay basis to 40 characters or fewer.';

  return {
    documentContext: Object.keys(errors).length === 0 ? {
      tax_code: optionalText(value.taxCode),
      national_insurance_category: optionalText(value.nationalInsuranceCategory),
      prsi_class: optionalText(value.prsiClass),
      pay_frequency: value.payFrequency || null,
      pay_basis: optionalText(value.payBasis),
    } : null,
    errors,
  };
}
