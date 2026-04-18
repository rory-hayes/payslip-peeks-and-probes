import type { CountryConfig } from './types';
import type { DeductionOptions, MonthlyBreakdown } from '../tax-calculator-types';
import { round } from '../tax-calculator-types';

/**
 * Portugal 2024 — single (não casado), no dependants, mainland.
 * IRS withholding approximated using 2024 progressive brackets:
 *   13.25% / 18% / 23% / 26% / 32.75% / 37% / 43.5% / 45% / 48%
 * Segurança Social employee share = 11% of gross (no cap for general regime).
 */
function calcPortugalMonthlyTax(annualSalary: number, opts: DeductionOptions): MonthlyBreakdown {
  const gross = annualSalary;

  const pensionRate = (opts.pensionPercent ?? 0) / 100;
  const annualPension = gross * pensionRate;

  // Segurança Social
  const social = gross * 0.11;

  const taxable = Math.max(0, gross - social - annualPension);

  // 2024 IRS brackets (mainland, single)
  const bands = [
    { upTo: 7_703, rate: 0.1325 },
    { upTo: 11_623, rate: 0.18 },
    { upTo: 16_472, rate: 0.23 },
    { upTo: 21_321, rate: 0.26 },
    { upTo: 27_146, rate: 0.3275 },
    { upTo: 39_791, rate: 0.37 },
    { upTo: 51_997, rate: 0.435 },
    { upTo: 81_199, rate: 0.45 },
    { upTo: Infinity, rate: 0.48 },
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

export const portugalConfig: CountryConfig = {
  code: 'Portugal',
  name: 'Portugal',
  flag: '🇵🇹',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'pt-PT',
  deductionLines: [
    { fieldKey: 'tax_amount', expectedKey: 'incomeTax', label: 'IRS' },
    { fieldKey: 'social_security_amount', expectedKey: 'nationalInsurance', label: 'Segurança Social' },
    { fieldKey: 'pension_amount', expectedKey: 'pension', label: 'PPR / Plano de pensões' },
  ],
  payslipKeywords: [
    'Vencimento bruto', 'Vencimento líquido', 'Total ilíquido', 'Líquido a receber',
    'IRS', 'Retenção na fonte', 'Imposto sobre o Rendimento',
    'Segurança Social', 'TSU', 'Contribuição Social',
    'Subsídio de férias', 'Subsídio de Natal',
    'Recibo de vencimento', 'Recibo de salário', 'PPR',
  ],
  calculateMonthly: calcPortugalMonthlyTax,
  taxAssumptionsBlurb: '2024 Portugal IRS brackets (mainland, single), Segurança Social 11%',
};
