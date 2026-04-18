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
  | 'Portugal';

export type CurrencyCode = 'GBP' | 'EUR';

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
}
