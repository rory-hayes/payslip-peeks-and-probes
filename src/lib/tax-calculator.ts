/**
 * Approximate monthly tax calculators per country (2024/25 rates).
 * These are simplified estimates — not formal tax advice.
 *
 * Country logic lives in src/lib/countries/<code>.ts. To add a country,
 * create a new config file and register it in src/lib/countries/index.ts.
 */
import { getCountryConfig } from './countries';
import type { CountryCode } from './countries';
import type { DeductionOptions, MonthlyBreakdown } from './tax-calculator-types';

export type { DeductionOptions, MonthlyBreakdown } from './tax-calculator-types';

export function calculateExpectedMonthly(
  annualSalary: number,
  country: CountryCode | null,
  opts: DeductionOptions = {},
): MonthlyBreakdown {
  return getCountryConfig(country).calculateMonthly(annualSalary, opts);
}
