/**
 * Shared types for the tax calculator + country registry.
 * Kept in their own file to avoid circular imports between
 * tax-calculator.ts and src/lib/countries/*.
 */

export interface DeductionOptions {
  pensionPercent?: number;
  hasStudentLoan?: boolean;
  studentLoanPlan?: 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';
  /** Sub-national region code (e.g. US state 'CA', 'NY'). Ignored by countries without subRegions. */
  subRegion?: string | null;
  /** Filing status code (e.g. 'single', 'married'). Ignored by countries without filingStatuses. */
  filingStatus?: string | null;
}

export interface MonthlyBreakdown {
  grossMonthly: number;
  incomeTax: number;
  /** UK National Insurance OR Ireland PRSI OR Germany Sozialversicherung (combined employee social security) OR US FICA */
  nationalInsurance: number;
  /** Ireland USC */
  usc: number;
  /** Germany Solidaritätszuschlag */
  solidarity: number;
  /** Germany Kirchensteuer */
  churchTax: number;
  pension: number;
  studentLoan: number;
  /** US state income tax (also reusable for any sub-national tax). 0 when not applicable. */
  stateTax?: number;
  totalDeductions: number;
  netPay: number;
}

export function round(n: number) {
  return Math.round(n * 100) / 100;
}
