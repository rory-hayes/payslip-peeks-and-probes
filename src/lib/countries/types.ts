/**
 * Country registry types — adding a new country = adding a new config file.
 * Used by the tax calculator, ExpectedVsActual UI, onboarding, and (via mirrored
 * keyword lists) the payslip-extraction prompt.
 */

import type { MonthlyBreakdown, DeductionOptions } from '../tax-calculator-types';

export type CountryCode =
  | 'UK'
  | 'Ireland'
  | 'Germany'
  | 'France'
  | 'Netherlands'
  | 'Spain'
  | 'Italy'
  | 'Belgium'
  | 'Portugal'
  | 'US';

export type CurrencyCode = 'GBP' | 'EUR' | 'USD';

export interface DeductionLine {
  /** Stable key matching a Payslip field (e.g. 'tax_amount', 'national_insurance_amount') */
  fieldKey:
    | 'tax_amount'
    | 'ni_amount'
    | 'prsi_amount'
    | 'usc_amount'
    | 'social_security_amount'
    | 'solidarity_amount'
    | 'church_tax_amount'
    | 'pension_amount'
    | 'student_loan_amount';
  /** Stable key on the MonthlyBreakdown returned by calculateExpectedMonthly */
  expectedKey: keyof MonthlyBreakdown;
  /** Display label, in the local payslip terminology */
  label: string;
}

/** A sub-national region (US state, Canadian province, German Land, etc.) */
export interface SubRegion {
  /** Stable code (e.g. 'CA', 'NY', 'TX'). Persisted on the profile.sub_region column. */
  code: string;
  /** Display name (e.g. 'California') */
  name: string;
}

/** A tax filing status (US/Canada/Germany Steuerklasse style) */
export interface FilingStatusOption {
  /** Stable code persisted on the profile.filing_status column */
  code: string;
  /** Short display label */
  label: string;
  /** Optional helper text */
  description?: string;
}

export interface CountryConfig {
  code: CountryCode;
  name: string;
  flag: string;
  currency: CurrencyCode;
  currencySymbol: string;
  locale: string;
  /** Lines to render in the Expected vs Actual table, in display order */
  deductionLines: DeductionLine[];
  /** Keywords/labels the payslip parser should look for on this country's payslips */
  payslipKeywords: string[];
  /** Compute expected monthly take-home from gross annual salary */
  calculateMonthly: (annualSalary: number, opts: DeductionOptions) => MonthlyBreakdown;
  /** Short, user-facing description of the tax assumptions used */
  taxAssumptionsBlurb: string;
  /** Optional: states/provinces. When present, UI shows a sub-region picker. */
  subRegions?: SubRegion[];
  /** Display label for the sub-region picker (e.g. 'State', 'Province') */
  subRegionLabel?: string;
  /** Optional: filing-status options. When present, UI shows a filing-status picker. */
  filingStatuses?: FilingStatusOption[];
  /** Display label for the filing-status picker */
  filingStatusLabel?: string;
}
