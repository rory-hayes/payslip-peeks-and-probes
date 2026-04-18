import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

/**
 * Spain 2024 — single, no children, no regional variation modelled (state scale only).
 * IRPF retention calculated against the state + average autonomous community brackets.
 * Seguridad Social employee share ≈ 6.48% of gross (4.7% common contingencies + 1.55% unemployment + 0.10% training + 0.13% MEI).
 * Capped at the base máxima (~€4,720.50/mo = €56,646/yr in 2024).
 */
function calcSpainMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;

  // Seguridad Social
  const ssCeiling = 56_646;
  const ssBase = Math.min(gross, ssCeiling);
  const social = ssBase * 0.0648;

  // IRPF taxable: gross - SS - pension - mínimo personal (€5,550)
  const personalMin = 5_550;
  const taxable = Math.max(0, gross - social - annualPension - personalMin);

  // Combined state + average CCAA bands 2024
  const bands = [
    { upTo: 12_450, rate: 0.19 },
    { upTo: 20_200, rate: 0.24 },
    { upTo: 35_200, rate: 0.30 },
    { upTo: 60_000, rate: 0.37 },
    { upTo: 300_000, rate: 0.45 },
    { upTo: Infinity, rate: 0.47 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of bands) {
    if (taxable > b.upTo) {
      tax += (b.upTo - prev) * b.rate;
      prev = b.upTo;
    } else {
      tax += (taxable - prev) * b.rate;
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

export const spainConfig: CountryConfig = {
  code: 'Spain',
  name: 'Spain',
  flag: '🇪🇸',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'es-ES',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'IRPF' },
    { fieldKey: 'social_security_amount', expectedKey: 'nationalInsurance', label: 'Seguridad Social' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: 'Plan de pensiones' },
  ],
  payslipKeywords: [
    'Salario bruto', 'Salario neto', 'Total devengado', 'Líquido a percibir',
    'IRPF', 'Retención IRPF', 'Impuesto sobre la Renta',
    'Seguridad Social', 'Contingencias comunes', 'Desempleo', 'Formación profesional', 'MEI',
    'Base de cotización', 'Plan de pensiones',
    'Nómina', 'Recibo de salarios',
  ],
  calculateMonthly: calcSpainMonthlyTax,
  taxAssumptionsBlurb: '2024 Spain: Single, no children, mínimo personal €5,550. IRPF combined state + average CCAA bands — your actual rate varies ±5% by Comunidad Autónoma (e.g. Madrid lower, Cataluña higher). Seguridad Social employee 6.48% (capped at base máxima €56,646). Excludes: deducciones por hijos, vivienda habitual, plan de pensiones de empresa.',
};
