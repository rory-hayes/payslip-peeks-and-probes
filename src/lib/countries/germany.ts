import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

/**
 * Germany 2024 — single, tax class I (Steuerklasse I), no children, no church tax by default.
 * Approximate Lohnsteuer using the official 2024 formula simplified to bracketed bands.
 * Social security shown as the combined employee share of:
 *   - Rentenversicherung (RV)        9.30%
 *   - Arbeitslosenversicherung (AV)  1.30%
 *   - Krankenversicherung (KV)       7.30% + 0.85% Zusatz (avg) = 8.15%
 *   - Pflegeversicherung (PV)        1.70% (no children surcharge ignored)
 * Combined employee share ≈ 20.45%, capped at the relevant Beitragsbemessungsgrenzen.
 *
 * Caps for 2024 (West):
 *   - RV/AV ceiling: €90,600/yr (€7,550/mo)
 *   - KV/PV ceiling: €62,100/yr (€5,175/mo)
 */
function calcGermanyMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  // Pension (bAV / Riester not modelled — treat profile pension % as pre-tax, like UK relief-at-source)
  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;
  const taxableGross = gross - annualPension;

  // ── Lohnsteuer (income tax) — 2024 bands (Grundtarif, single) ──
  const grundfreibetrag = 11_604;
  let tax = 0;
  if (taxableGross <= grundfreibetrag) {
    tax = 0;
  } else if (taxableGross <= 17_005) {
    // Linear-progressive zone 1: 14% rising to ~24%
    const y = (taxableGross - grundfreibetrag) / 10_000;
    tax = (922.98 * y + 1_400) * y;
  } else if (taxableGross <= 66_760) {
    // Linear-progressive zone 2: ~24% rising to 42%
    const z = (taxableGross - 17_005) / 10_000;
    tax = (181.19 * z + 2_397) * z + 1_025.38;
  } else if (taxableGross <= 277_825) {
    // Flat 42% above ~€66,760
    tax = 0.42 * taxableGross - 10_602.13;
  } else {
    // "Reichensteuer" 45% above ~€277,825
    tax = 0.45 * taxableGross - 18_936.88;
  }

  // ── Solidaritätszuschlag (5.5% of income tax above the exemption) ──
  // 2024 exemption: no Soli below ~€18,130 of income tax for singles; sliding zone above.
  // Simplified: only apply the full 5.5% on tax once tax > €18,130.
  let solidarity = 0;
  if (tax > 18_130) solidarity = (tax - 18_130) * 0.055;

  // ── Sozialversicherung (employee share, capped) ──
  const rvAvCeiling = 90_600;
  const kvPvCeiling = 62_100;
  const rvBase = Math.min(gross, rvAvCeiling);
  const kvBase = Math.min(gross, kvPvCeiling);

  const rv = rvBase * 0.093;       // pension insurance
  const av = rvBase * 0.013;       // unemployment insurance
  const kv = kvBase * 0.0815;      // health (incl. avg Zusatzbeitrag)
  const pv = kvBase * 0.017;       // long-term care (no children surcharge ignored)
  const social = rv + av + kv + pv;

  // Church tax not applied by default (most workers opt out / not religious)
  const churchTax = 0;

  // Student loan — Germany has BAföG repayments, not a payroll deduction. Skip.
  const studentLoan = 0;

  const grossMonthly = gross / 12;
  const monthlyTax = tax / 12;
  const monthlySoli = solidarity / 12;
  const monthlySocial = social / 12;
  const monthlyPension = annualPension / 12;
  const totalDeductions = monthlyTax + monthlySoli + monthlySocial + monthlyPension + churchTax / 12;

  return {
    grossMonthly: round(grossMonthly),
    incomeTax: round(monthlyTax),
    nationalInsurance: round(monthlySocial),
    usc: 0,
    solidarity: round(monthlySoli),
    churchTax: round(churchTax / 12),
    pension: round(monthlyPension),
    studentLoan,
    totalDeductions: round(totalDeductions),
    netPay: round(grossMonthly - totalDeductions),
  };
}

export const germanyConfig: CountryConfig = {
  code: 'Germany',
  name: 'Germany',
  flag: '🇩🇪',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'de-DE',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'Lohnsteuer' },
    { fieldKey: 'solidarity_amount', expectedKey: 'solidarity', label: 'Solidaritätszuschlag' },
    { fieldKey: 'social_security_amount', expectedKey: 'nationalInsurance', label: 'Sozialversicherung' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: 'Betriebsrente' },
  ],
  payslipKeywords: [
    'Brutto', 'Netto', 'Auszahlungsbetrag', 'Lohnsteuer', 'Einkommensteuer',
    'Solidaritätszuschlag', 'Soli', 'Kirchensteuer', 'KiSt',
    'Sozialversicherung', 'Sozialabgaben', 'SV-Beitrag',
    'Rentenversicherung', 'RV', 'Arbeitslosenversicherung', 'AV',
    'Krankenversicherung', 'KV', 'Pflegeversicherung', 'PV',
    'Steuerklasse', 'Lohnsteuerklasse', 'Steuer-ID', 'SV-Nummer',
    'Betriebsrente', 'Gehaltsumwandlung',
  ],
  calculateMonthly: calcGermanyMonthlyTax,
  taxAssumptionsBlurb: '2024 Germany Lohnsteuer (Steuerklasse I), Soli, combined employee Sozialversicherung at average rates',
};
