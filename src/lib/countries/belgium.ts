import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

/**
 * Belgium 2024 — single (isolé), no dependants, standard worker.
 * Précompte professionnel approximated using 2024 IPP brackets:
 *   - 25% up to €15,820
 *   - 40% €15,820 – €27,920
 *   - 45% €27,920 – €48,320
 *   - 50% above €48,320
 * Quotité exemptée €10,160 (rough — applies first slice as 0% via reduction).
 * ONSS employee share = 13.07% of gross (no cap).
 * Communal additional ~7% of state IPP — bundled into incomeTax.
 */
function calcBelgiumMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;

  // ONSS (Sécurité sociale)
  const social = gross * 0.1307;

  // Taxable for IPP
  const taxable = Math.max(0, gross - social - annualPension);

  // 2024 IPP bands (apply quotité exemptée by zeroing the first slice)
  const exempt = 10_160;
  const taxableAboveExempt = Math.max(0, taxable - exempt);

  const bands = [
    { upTo: 15_820 - exempt, rate: 0.25 },
    { upTo: 27_920 - exempt, rate: 0.40 },
    { upTo: 48_320 - exempt, rate: 0.45 },
    { upTo: Infinity, rate: 0.50 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of bands) {
    if (taxableAboveExempt > b.upTo) {
      tax += (b.upTo - prev) * b.rate;
      prev = b.upTo;
    } else {
      tax += (taxableAboveExempt - prev) * b.rate;
      break;
    }
  }

  // Communal additional ~7% (avg)
  const communalAdditional = tax * 0.07;

  const grossMonthly = gross / 12;
  const monthlyTax = (tax + communalAdditional) / 12;
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

export const belgiumConfig: CountryConfig = {
  code: 'Belgium',
  name: 'Belgium',
  flag: '🇧🇪',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'fr-BE',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'Précompte professionnel' },
    { fieldKey: 'social_security_amount', expectedKey: 'nationalInsurance', label: 'ONSS / RSZ' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: 'Pension complémentaire' },
  ],
  payslipKeywords: [
    'Salaire brut', 'Salaire net', 'Brutto loon', 'Netto loon',
    'Précompte professionnel', 'Bedrijfsvoorheffing',
    'ONSS', 'RSZ', 'Sécurité sociale', 'Sociale zekerheid',
    'Pécule de vacances', 'Vakantiegeld',
    'Fiche de paie', 'Loonfiche', 'Pension complémentaire', 'Aanvullend pensioen',
  ],
  calculateMonthly: calcBelgiumMonthlyTax,
  taxAssumptionsBlurb: '2024 Belgium: Single (isolé), no dependants, quotité exemptée €10,160. ONSS employee 13.07% (no cap). Communal additional ≈7% (avg — varies 0%–9% by commune). Excludes: cotisation spéciale de sécurité sociale (€0–60/mo), bonus à l\'emploi, frais professionnels forfaitaires détaillés.',
};
