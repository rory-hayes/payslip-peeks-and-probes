import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

/**
 * United States 2024 — Phase 1: FEDERAL ONLY, single filer.
 *
 * Includes:
 *   - Federal income tax (2024 single brackets) on income above the standard deduction ($14,600)
 *   - FICA Social Security: 6.2% on wages up to $168,600 wage base
 *   - FICA Medicare: 1.45% on all wages, +0.9% Additional Medicare on wages above $200,000
 *
 * Pension input is treated as a traditional pre-tax 401(k) contribution
 * (reduces federal taxable wages, but FICA still applies to the full gross — IRS rule).
 *
 * NOT modelled in Phase 1:
 *   - State income tax (CA, NY, etc.) — varies wildly by state, planned for Phase 2
 *   - City/local tax (NYC, SF, Philadelphia)
 *   - Married-filing-jointly / Head-of-household brackets
 *   - SDI / SUI (state disability / unemployment)
 *   - Roth 401(k), HSA, FSA pre-tax contributions
 *   - Federal withholding allowances / W-4 adjustments
 */
function calcUSMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  // Pre-tax 401(k) contribution (reduces federal taxable income only)
  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;

  // ── Federal income tax (2024 single brackets) ──
  const standardDeduction = 14_600;
  const taxableIncome = Math.max(0, gross - annualPension - standardDeduction);

  const bands = [
    { upTo: 11_600, rate: 0.10 },
    { upTo: 47_150, rate: 0.12 },
    { upTo: 100_525, rate: 0.22 },
    { upTo: 191_950, rate: 0.24 },
    { upTo: 243_725, rate: 0.32 },
    { upTo: 609_350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ];

  let federalTax = 0;
  let prevLimit = 0;
  for (const band of bands) {
    if (taxableIncome <= prevLimit) break;
    const inBand = Math.min(taxableIncome, band.upTo) - prevLimit;
    federalTax += inBand * band.rate;
    prevLimit = band.upTo;
  }

  // ── FICA (always on full gross — 401(k) does NOT reduce FICA wages) ──
  const ssWageBase = 168_600;
  const socialSecurity = Math.min(gross, ssWageBase) * 0.062;

  let medicare = gross * 0.0145;
  if (gross > 200_000) {
    medicare += (gross - 200_000) * 0.009; // Additional Medicare Tax
  }

  const fica = socialSecurity + medicare;

  // No student loan payroll deduction in the US (federal student loans are paid separately)
  const studentLoan = 0;

  const grossMonthly = gross / 12;
  const monthlyFederalTax = federalTax / 12;
  const monthlyFica = fica / 12;
  const monthlyPension = annualPension / 12;
  const totalDeductions = monthlyFederalTax + monthlyFica + monthlyPension;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyFederalTax),
    nationalInsurance: round(monthlyFica), // FICA reuses the "social security" slot
    usc: 0,
    solidarity: 0,
    churchTax: 0,
    pension: round(monthlyPension),
    studentLoan,
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

export const usConfig: CountryConfig = {
  code: 'US',
  name: 'United States',
  flag: '🇺🇸',
  currency: 'USD',
  currencySymbol: '$',
  locale: 'en-US',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'Federal income tax' },
    { fieldKey: 'social_security_amount', expectedKey: 'nationalInsurance', label: 'FICA (Social Security + Medicare)' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: '401(k) contribution' },
  ],
  payslipKeywords: [
    'Federal Withholding', 'Federal Income Tax', 'Fed W/H', 'FIT',
    'FICA', 'OASDI', 'Social Security', 'SS Tax',
    'Medicare', 'Med Tax', 'FICA-HI',
    'State Tax', 'SIT', 'SDI', 'SUI',
    'Gross Pay', 'Net Pay', 'Take Home',
    '401(k)', '401k', 'Roth 401(k)', 'HSA', 'FSA',
    'YTD', 'Year to Date', 'Pay Period',
  ],
  calculateMonthly: calcUSMonthlyTax,
  taxAssumptionsBlurb: '2024 US: FEDERAL ONLY — state and local taxes are NOT included (these vary widely: 0% in TX/FL/WA, up to 13.3% in CA, plus city tax in NYC/SF). Single filer, standard deduction $14,600. Federal brackets 10/12/22/24/32/35/37%. FICA: Social Security 6.2% on wages up to $168,600, Medicare 1.45% (+0.9% above $200k). Pension input treated as pre-tax 401(k) (reduces federal tax but not FICA). Excludes: married-jointly/HoH brackets, dependents, HSA/FSA, SDI/SUI.',
};
