/**
 * Shared types for the tax calculator + country registry.
 * Kept in their own file to avoid circular imports between
 * tax-calculator.ts and src/lib/countries/*.
 */

export interface DeductionOptions {
  pensionPercent?: number;
  hasStudentLoan?: boolean;
  studentLoanPlan?: 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';
}

export interface MonthlyBreakdown {
  grossMonthly: number;
  incomeTax: number;
  /** UK National Insurance OR Ireland PRSI OR Germany Sozialversicherung (combined employee social security) */
  nationalInsurance: number;
  /** Ireland USC */
  usc: number;
  /** Germany Solidaritätszuschlag */
  solidarity: number;
  /** Germany Kirchensteuer */
  churchTax: number;
  pension: number;
  studentLoan: number;
  totalDeductions: number;
  netPay: number;
}

export function round(n: number) {
  return Math.round(n * 100) / 100;
}
