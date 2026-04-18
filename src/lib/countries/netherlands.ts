import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

/**
 * Netherlands 2024 — single, under retirement age, standard loonheffingskorting applied.
 * Combined Loonheffing = Loonbelasting + premies volksverzekeringen
 *   Box 1 brackets 2024 (under AOW age):
 *     - up to €38,098 → 36.97% (incl. 27.65% volksverzekeringen)
 *     - €38,098 – €75,518 → 36.97%
 *     - above €75,518 → 49.50%
 *   Algemene heffingskorting + arbeidskorting applied (rough single-person estimate).
 * Zorgverzekeringswet (ZVW) employee bijdrage = paid via premium, not on payslip.
 *   Most payslips show only loonheffing as "tax" line.
 */
function calcNetherlandsMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;
  const taxableGross = Math.max(0, gross - annualPension);

  // 2024 Box 1 (under AOW)
  let tax = 0;
  if (taxableGross <= 75_518) {
    tax = taxableGross * 0.3697;
  } else {
    tax = 75_518 * 0.3697 + (taxableGross - 75_518) * 0.495;
  }

  // Heffingskortingen (rough — algemene + arbeidskorting combined, simplified)
  // Algemene heffingskorting 2024 max €3,362, phases out from ~€24,813
  const algKorting = taxableGross <= 24_813
    ? 3_362
    : Math.max(0, 3_362 - (taxableGross - 24_813) * 0.06337);
  // Arbeidskorting max €5,532 around €37k, phases out above ~€39k
  let arbeidsKorting = 0;
  if (taxableGross > 11_490) {
    if (taxableGross <= 37_691) {
      arbeidsKorting = Math.min(5_532, (taxableGross - 11_490) * 0.31459);
    } else if (taxableGross <= 115_295) {
      arbeidsKorting = Math.max(0, 5_532 - (taxableGross - 37_691) * 0.0651);
    }
  }
  tax = Math.max(0, tax - algKorting - arbeidsKorting);

  const grossMonthly = gross / 12;
  const monthlyTax = tax / 12;
  const monthlyPension = annualPension / 12;
  const totalDeductions = monthlyTax + monthlyPension;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyTax),
    nationalInsurance: 0, // bundled into loonheffing on Dutch payslips
    usc: 0,
    solidarity: 0,
    churchTax: 0,
    pension: round(monthlyPension),
    studentLoan: 0,
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

export const netherlandsConfig: CountryConfig = {
  code: 'Netherlands',
  name: 'Netherlands',
  flag: '🇳🇱',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'nl-NL',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'Loonheffing' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: 'Pensioen' },
  ],
  payslipKeywords: [
    'Brutoloon', 'Nettoloon', 'Loonheffing', 'Loonbelasting',
    'Volksverzekeringen', 'AOW', 'WW', 'WLZ', 'WIA',
    'Zorgverzekeringswet', 'ZVW', 'Bijzonder tarief',
    'Heffingskorting', 'Arbeidskorting', 'Pensioenpremie',
    'Vakantiegeld', 'Salarisstrook', 'Loonstrook',
  ],
  calculateMonthly: calcNetherlandsMonthlyTax,
  taxAssumptionsBlurb: '2024 Netherlands Box 1 brackets, algemene heffingskorting + arbeidskorting (single, under AOW age)',
};
