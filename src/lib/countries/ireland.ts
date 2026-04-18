import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

function calcIrelandMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;
  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;
  const taxableGross = gross - annualPension;

  const stdRateBand = 42_000;
  let tax = 0;
  if (taxableGross <= stdRateBand) tax = taxableGross * 0.20;
  else tax = stdRateBand * 0.20 + (taxableGross - stdRateBand) * 0.40;
  const taxCredits = 1_875 + 1_875;
  tax = Math.max(0, tax - taxCredits);

  const prsiExempt = 352 * 52;
  const prsi = gross > prsiExempt ? gross * 0.04 : 0;

  let usc = 0;
  const uscBands = [
    { limit: 12_012, rate: 0.005 },
    { limit: 25_760 - 12_012, rate: 0.02 },
    { limit: 70_044 - 25_760, rate: 0.04 },
    { limit: Infinity, rate: 0.08 },
  ];
  let rem = gross;
  for (const band of uscBands) {
    const inBand = Math.min(rem, band.limit);
    usc += inBand * band.rate;
    rem -= inBand;
    if (rem <= 0) break;
  }

  const grossMonthly = gross / 12;
  const monthlyTax = tax / 12;
  const monthlyPRSI = prsi / 12;
  const monthlyUSC = usc / 12;
  const monthlyPension = annualPension / 12;
  const totalDeductions = monthlyTax + monthlyPRSI + monthlyUSC + monthlyPension;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyTax),
    nationalInsurance: round(monthlyPRSI),
    usc: round(monthlyUSC),
    solidarity: 0,
    churchTax: 0,
    pension: round(monthlyPension),
    studentLoan: 0,
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

export const irelandConfig: CountryConfig = {
  code: 'Ireland',
  name: 'Ireland',
  flag: '🇮🇪',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'en-IE',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'PAYE' },
    { fieldKey: 'prsi_amount', expectedKey: 'nationalInsurance', label: 'PRSI' },
    { fieldKey: 'usc_amount', expectedKey: 'usc', label: 'USC' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: 'Pension' },
  ],
  payslipKeywords: [
    'PAYE', 'PRSI', 'USC', 'Universal Social Charge', 'Tax Credit',
    'Standard Rate Cut Off', 'Gross Pay', 'Net Pay', 'PPS', 'Pension',
  ],
  calculateMonthly: calcIrelandMonthlyTax,
  taxAssumptionsBlurb: '2024 Ireland PAYE bands, single-person credits, Class A1 PRSI',
};
