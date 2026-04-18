import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

/**
 * France 2024 — single, no children, standard PAS (Prélèvement à la source).
 * Income tax (IR) calculated on net taxable salary using barème progressif (single part).
 * Social contributions (employee share, simplified):
 *   - CSG/CRDS              ≈ 9.7% of 98.25% of gross (we apply ~9.5% of gross)
 *   - Sécurité sociale (vieillesse + chômage + complémentaire) ≈ 12% of gross (combined)
 * Combined employee share ≈ 22% of gross (rough average for cadres/non-cadres mid-band).
 */
function calcFranceMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;

  // Social contributions (employee share, simplified)
  const csgCrds = gross * 0.095;            // CSG/CRDS
  const secSociale = gross * 0.12;          // vieillesse + chômage + complémentaire (cadre avg)
  const social = csgCrds + secSociale;

  // Net taxable for IR (rough — abattement of 10% capped, plus pension)
  const abattement = Math.min(gross * 0.10, 14_171);
  const taxableIR = Math.max(0, gross - abattement - annualPension);

  // 2024 barème (single — 1 part)
  const bands = [
    { upTo: 11_294, rate: 0 },
    { upTo: 28_797, rate: 0.11 },
    { upTo: 82_341, rate: 0.30 },
    { upTo: 177_106, rate: 0.41 },
    { upTo: Infinity, rate: 0.45 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of bands) {
    if (taxableIR > b.upTo) {
      tax += (b.upTo - prev) * b.rate;
      prev = b.upTo;
    } else {
      tax += (taxableIR - prev) * b.rate;
      break;
    }
  }

  const grossMonthly = gross / 12;
  const monthlyTax = tax / 12;
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

export const franceConfig: CountryConfig = {
  code: 'France',
  name: 'France',
  flag: '🇫🇷',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'fr-FR',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'Prélèvement à la source' },
    { fieldKey: 'social_security_amount', expectedKey: 'nationalInsurance', label: 'Cotisations sociales' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: 'Retraite complémentaire' },
  ],
  payslipKeywords: [
    'Salaire brut', 'Salaire net', 'Net à payer', 'Net imposable',
    'Prélèvement à la source', 'PAS', 'Impôt sur le revenu',
    'CSG', 'CRDS', 'Sécurité sociale', 'Assurance maladie',
    'Vieillesse', 'Chômage', 'Retraite complémentaire', 'AGIRC-ARRCO',
    'Cotisations salariales', 'Cotisations patronales', 'Bulletin de paie',
  ],
  calculateMonthly: calcFranceMonthlyTax,
  taxAssumptionsBlurb: '2024 France barème IR (1 part), PAS, combined employee CSG/CRDS + Sécurité sociale at average rates',
};
