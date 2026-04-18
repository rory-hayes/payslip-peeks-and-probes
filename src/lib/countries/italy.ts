import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

/**
 * Italy 2024 — single, no dependants, standard worker.
 * IRPEF brackets (2024 reform): 23%/35%/43%.
 * Addizionali (regional + comunale) ≈ 2% combined average — bundled into incomeTax.
 * INPS employee share ≈ 9.19% of gross (capped at €119,650 in 2024).
 * Detrazione lavoro dipendente applied as rough single-person credit.
 */
function calcItalyMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;

  // INPS
  const inpsCeiling = 119_650;
  const inpsBase = Math.min(gross, inpsCeiling);
  const social = inpsBase * 0.0919;

  const taxableGross = Math.max(0, gross - social - annualPension);

  // IRPEF 2024 (post-reform: 3 bands)
  const bands = [
    { upTo: 28_000, rate: 0.23 },
    { upTo: 50_000, rate: 0.35 },
    { upTo: Infinity, rate: 0.43 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of bands) {
    if (taxableGross > b.upTo) {
      tax += (b.upTo - prev) * b.rate;
      prev = b.upTo;
    } else {
      tax += (taxableGross - prev) * b.rate;
      break;
    }
  }

  // Detrazione lavoro dipendente 2024 (single, simplified)
  let detrazione = 0;
  if (taxableGross <= 15_000) detrazione = 1_955;
  else if (taxableGross <= 28_000) detrazione = 1_910 + 1_190 * (28_000 - taxableGross) / 13_000;
  else if (taxableGross <= 50_000) detrazione = 1_910 * (50_000 - taxableGross) / 22_000;
  tax = Math.max(0, tax - detrazione);

  // Addizionali regionali + comunali (~2% average)
  const addizionali = taxableGross * 0.02;

  const grossMonthly = gross / 12;
  const monthlyTax = (tax + addizionali) / 12;
  const monthlySocial = social / 12;
  const monthlyPension = annualPension / 12;
  const totalDeductions = monthlyTax + monthlySocial + monthlyPension;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyTax),
    nationalInsurance: round(monthlySocial),
    usc: 0,
    solidarity: 0,
    churchTax: 0,
    pension: round(monthlyPension),
    studentLoan: 0,
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

export const italyConfig: CountryConfig = {
  code: 'Italy',
  name: 'Italy',
  flag: '🇮🇹',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'it-IT',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'IRPEF + Addizionali' },
    { fieldKey: 'social_security_amount', expectedKey: 'nationalInsurance', label: 'Contributi INPS' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: 'Previdenza complementare' },
  ],
  payslipKeywords: [
    'Retribuzione lorda', 'Retribuzione netta', 'Netto a pagare',
    'IRPEF', 'Imposta sul reddito', 'Addizionale regionale', 'Addizionale comunale',
    'INPS', 'Contributi previdenziali', 'Contributo IVS',
    'Detrazione lavoro dipendente', 'TFR',
    'Busta paga', 'Cedolino', 'Previdenza complementare',
  ],
  calculateMonthly: calcItalyMonthlyTax,
  taxAssumptionsBlurb: '2024 Italy: Single, no dependants. Post-reform IRPEF 3 bands (23%/35%/43%). INPS dipendente 9.19% (capped at €119,650; 9.49% in upper tier not modelled). Addizionale regionale + comunale ≈2% national average — actual varies 1.23%–3.33% by region/comune. TFR not deducted from net (handled separately by employer).',
};
