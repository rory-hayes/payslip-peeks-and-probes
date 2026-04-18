import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

function calcUKMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;
  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;
  const taxableGross = gross - annualPension;

  const personalAllowance = 12_570;
  const effectivePA = taxableGross > 100_000
    ? Math.max(0, personalAllowance - (taxableGross - 100_000) / 2)
    : personalAllowance;
  const taxable = Math.max(0, taxableGross - effectivePA);

  let tax = 0;
  const bands = [
    { limit: 37_700, rate: 0.20 },
    { limit: 125_140 - 50_270, rate: 0.40 },
    { limit: Infinity, rate: 0.45 },
  ];
  let remaining = taxable;
  for (const band of bands) {
    const inBand = Math.min(remaining, band.limit);
    tax += inBand * band.rate;
    remaining -= inBand;
    if (remaining <= 0) break;
  }

  const niThreshold = 12_570;
  const niUpper = 50_270;
  let ni = 0;
  if (taxableGross > niThreshold) {
    ni += Math.min(taxableGross - niThreshold, niUpper - niThreshold) * 0.08;
    if (taxableGross > niUpper) ni += (taxableGross - niUpper) * 0.02;
  }

  let studentLoan = 0;
  if (opts.hasStudentLoan) {
    const plan = opts.studentLoanPlan ?? 'plan2';
    const slConfig: Record<string, { threshold: number; rate: number }> = {
      plan1: { threshold: 22_015, rate: 0.09 },
      plan2: { threshold: 27_295, rate: 0.09 },
      plan4: { threshold: 27_660, rate: 0.09 },
      plan5: { threshold: 25_000, rate: 0.09 },
      postgrad: { threshold: 21_000, rate: 0.06 },
    };
    const cfg = slConfig[plan];
    if (gross > cfg.threshold) studentLoan = (gross - cfg.threshold) * cfg.rate;
  }

  const grossMonthly = gross / 12;
  const monthlyTax = tax / 12;
  const monthlyNI = ni / 12;
  const monthlyPension = annualPension / 12;
  const monthlyStudentLoan = studentLoan / 12;
  const totalDeductions = monthlyTax + monthlyNI + monthlyPension + monthlyStudentLoan;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyTax),
    nationalInsurance: round(monthlyNI),
    usc: 0,
    solidarity: 0,
    churchTax: 0,
    pension: round(monthlyPension),
    studentLoan: round(monthlyStudentLoan),
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

export const ukConfig: CountryConfig = {
  code: 'UK',
  name: 'United Kingdom',
  flag: '🇬🇧',
  currency: 'GBP',
  currencySymbol: '£',
  locale: 'en-GB',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'Income tax' },
    { fieldKey: 'ni_amount', expectedKey: 'nationalInsurance', label: 'National Insurance' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: 'Pension' },
    { fieldKey: 'student_loan_amount', expectedKey: 'studentLoan', label: 'Student loan' },
  ],
  payslipKeywords: [
    'PAYE', 'Income Tax', 'Tax Code', 'National Insurance', 'NI', 'NIC',
    'Gross Pay', 'Net Pay', 'Taxable Pay', 'Pension', 'Student Loan',
    'Plan 1', 'Plan 2', 'Plan 4', 'Plan 5', 'Postgrad',
  ],
  calculateMonthly: calcUKMonthlyTax,
  taxAssumptionsBlurb: '2024/25 UK: England/Wales/NI rates (Scotland not modelled — Scottish rates differ at 19%/20%/21%/42%/45%/48%). Standard personal allowance £12,570 (tapered above £100k). Class 1 NI at 8% / 2%. Pension treated as relief-at-source (pre-tax). Marriage allowance, blind person allowance not applied.',
};
