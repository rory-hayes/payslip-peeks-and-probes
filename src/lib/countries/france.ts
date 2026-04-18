import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

/**
 * France 2024 — single (1 part fiscale), no children, non-cadre, standard PAS.
 * Source: impots.gouv.fr (barème 2024), URSSAF taux 2024, BOSS.gouv.fr.
 *
 * Social contributions modelled (employee share, with PMSS caps where applicable):
 *   - CSG déductible       6.80% on 98.25% of gross (uncapped, abattement de 1.75%)
 *   - CSG non-déductible   2.40% on 98.25% of gross (uncapped)
 *   - CRDS                 0.50% on 98.25% of gross (uncapped)
 *   - Sécurité sociale (vieillesse plafonnée) 6.90% on Tranche 1 (≤ PMSS €3,864/mo = €46,368/yr)
 *   - Sécurité sociale (vieillesse déplafonnée) 0.40% on full gross
 *   - AGIRC-ARRCO Tranche 1 (non-cadre) 3.15% on ≤ PMSS
 *   - AGIRC-ARRCO Tranche 2 (non-cadre) 8.64% on PMSS – 8×PMSS
 *   - APEC (cadre only) — NOT applied (defaulting to non-cadre)
 *
 * IR: standard 10% abattement (€448 min, €13,522 max for 2023 income), then 2024 barème.
 * NB: PAS rate = effective average rate from previous year — we approximate with current-year barème.
 */
const PMSS_2024 = 3_864 * 12; // €46,368/yr — Plafond mensuel de la Sécurité sociale

function calcFranceMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;

  // ── CSG / CRDS (on 98.25% of gross, abattement de 1.75%) ──
  const csgCrdsBase = gross * 0.9825;
  const csgDed = csgCrdsBase * 0.0680;       // CSG déductible
  const csgNonDed = csgCrdsBase * 0.0240;    // CSG non-déductible
  const crds = csgCrdsBase * 0.0050;         // CRDS

  // ── Sécurité sociale vieillesse (plafonnée + déplafonnée) ──
  const tranche1 = Math.min(gross, PMSS_2024);
  const ssVieillessePlaf = tranche1 * 0.069;
  const ssVieillesseDeplaf = gross * 0.004;

  // ── AGIRC-ARRCO (retraite complémentaire, non-cadre) ──
  const arrcoT1 = tranche1 * 0.0315;
  const trancheAbove = Math.max(0, gross - PMSS_2024);
  const arrcoT2 = Math.min(trancheAbove, 7 * PMSS_2024) * 0.0864;

  const social = csgDed + csgNonDed + crds + ssVieillessePlaf + ssVieillesseDeplaf + arrcoT1 + arrcoT2;

  // ── Impôt sur le revenu (barème 2024, 1 part) ──
  // Net imposable ≈ gross - CSG déductible - 10% abattement (capped)
  const abattement10 = Math.min(Math.max((gross - csgDed) * 0.10, 448), 13_522);
  const taxableIR = Math.max(0, gross - csgDed - abattement10 - annualPension);

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
  taxAssumptionsBlurb: '2024 France: Single (1 part), non-cadre, mainland. CSG/CRDS on 98.25% of gross, vieillesse capped at PMSS (€3,864/mo), AGIRC-ARRCO T1+T2. PAS approximated using current-year barème. If you are cadre, your AGIRC-ARRCO T2 rate and APEC contribution will differ. Ne tient pas compte du quotient familial.',
};
