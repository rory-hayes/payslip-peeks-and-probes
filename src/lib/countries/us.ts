import type { CountryConfig, FilingStatusOption, SubRegion } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';
import { US_STATES, US_STATE_BY_CODE, calculateStateTax, type FilingStatus } from './us-states';

/**
 * United States 2024 — Phase 2: Federal + state income tax, single or MFJ.
 *
 * Federal:
 *   - Income tax brackets per filing status (2024)
 *   - Standard deduction $14,600 single / $29,200 married
 *   - FICA Social Security 6.2% to wage base $168,600
 *   - FICA Medicare 1.45% all wages, +0.9% Additional Medicare above $200,000 (single threshold)
 *
 * State:
 *   - Per-state brackets / flat / none from us-states.ts
 *   - 401(k) reduces state taxable income everywhere except PA and NJ (per us-states cfg)
 *
 * Pension input = traditional pre-tax 401(k) contribution.
 *   - Reduces federal taxable wages
 *   - Reduces state taxable wages (except PA/NJ)
 *   - Does NOT reduce FICA wages (IRS rule)
 *
 * NOT modelled:
 *   - City/local tax (NYC, SF, Cleveland, Detroit, etc.)
 *   - State SDI / SUI / paid family leave
 *   - HSA / FSA / Roth 401(k)
 *   - Married-filing-separately / Head-of-household
 *   - W-4 allowances / Additional withholding
 */

const FEDERAL_BRACKETS_SINGLE = [
  { upTo: 11_600, rate: 0.10 },
  { upTo: 47_150, rate: 0.12 },
  { upTo: 100_525, rate: 0.22 },
  { upTo: 191_950, rate: 0.24 },
  { upTo: 243_725, rate: 0.32 },
  { upTo: 609_350, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

const FEDERAL_BRACKETS_MARRIED = [
  { upTo: 23_200, rate: 0.10 },
  { upTo: 94_300, rate: 0.12 },
  { upTo: 201_050, rate: 0.22 },
  { upTo: 383_900, rate: 0.24 },
  { upTo: 487_450, rate: 0.32 },
  { upTo: 731_200, rate: 0.35 },
  { upTo: Infinity, rate: 0.37 },
];

const STD_DEDUCTION_SINGLE = 14_600;
const STD_DEDUCTION_MARRIED = 29_200;
const SS_WAGE_BASE = 168_600;
const ADDITIONAL_MEDICARE_THRESHOLD_SINGLE = 200_000;
const ADDITIONAL_MEDICARE_THRESHOLD_MARRIED = 250_000;

function calcUSMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;
  const filingStatus: FilingStatus = (opts.filingStatus === 'married' ? 'married' : 'single');
  const stateCode = opts.subRegion ?? null;
  const stateCfg = stateCode ? US_STATE_BY_CODE[stateCode] : null;

  // Pre-tax 401(k) (federal: always reduces; state: reduces unless PA/NJ)
  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;

  // ── FEDERAL income tax ──
  const federalStdDed = filingStatus === 'married' ? STD_DEDUCTION_MARRIED : STD_DEDUCTION_SINGLE;
  const federalTaxable = Math.max(0, gross - annualPension - federalStdDed);
  const federalBands = filingStatus === 'married' ? FEDERAL_BRACKETS_MARRIED : FEDERAL_BRACKETS_SINGLE;

  let federalTax = 0;
  let prevLimit = 0;
  for (const band of federalBands) {
    if (federalTaxable <= prevLimit) break;
    const inBand = Math.min(federalTaxable, band.upTo) - prevLimit;
    federalTax += inBand * band.rate;
    prevLimit = band.upTo;
  }

  // ── STATE income tax ──
  let stateTax = 0;
  if (stateCfg) {
    const pretaxAllowed = !stateCfg.pretax401kNotAllowed;
    const stateTaxableBase = pretaxAllowed ? gross - annualPension : gross;
    stateTax = calculateStateTax(stateCfg.code, stateTaxableBase, filingStatus);
  }

  // ── FICA (always on full gross) ──
  const socialSecurity = Math.min(gross, SS_WAGE_BASE) * 0.062;

  let medicare = gross * 0.0145;
  const addlMedicareThreshold = filingStatus === 'married'
    ? ADDITIONAL_MEDICARE_THRESHOLD_MARRIED
    : ADDITIONAL_MEDICARE_THRESHOLD_SINGLE;
  if (gross > addlMedicareThreshold) {
    medicare += (gross - addlMedicareThreshold) * 0.009;
  }

  const fica = socialSecurity + medicare;

  const grossMonthly = gross / 12;
  const monthlyFederalTax = federalTax / 12;
  const monthlyStateTax = stateTax / 12;
  const monthlyFica = fica / 12;
  const monthlyPension = annualPension / 12;
  const totalDeductions = monthlyFederalTax + monthlyStateTax + monthlyFica + monthlyPension;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyFederalTax),
    nationalInsurance: round(monthlyFica),
    usc: 0,
    solidarity: 0,
    churchTax: 0,
    pension: round(monthlyPension),
    studentLoan: 0,
    stateTax: round(monthlyStateTax),
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

const subRegions: SubRegion[] = US_STATES
  .map((s) => ({ code: s.code, name: s.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const filingStatuses: FilingStatusOption[] = [
  { code: 'single', label: 'Single', description: 'Unmarried, or married filing separately' },
  { code: 'married', label: 'Married filing jointly', description: 'Combined income with spouse' },
];

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
  taxAssumptionsBlurb: '2024 US: Federal + state income tax. Federal brackets 10/12/22/24/32/35/37%, standard deduction $14,600 (single) / $29,200 (married jointly). FICA: Social Security 6.2% to $168,600, Medicare 1.45% (+0.9% above $200k single / $250k married). State tax per your state selection. Pension treated as pre-tax 401(k) (reduces federal + state tax everywhere except PA/NJ; never reduces FICA). Excludes: city tax (NYC/SF/Philadelphia etc.), SDI/SUI, HSA/FSA, married-filing-separately, head-of-household, dependents.',
  subRegions,
  subRegionLabel: 'State',
  filingStatuses,
  filingStatusLabel: 'Filing status',
};
