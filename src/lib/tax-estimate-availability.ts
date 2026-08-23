import type { CountryCode } from '@/lib/countries';

export interface TaxEstimateAvailability {
  available: boolean;
  supportedPeriod: string | null;
  message: string;
}

interface HistoricalTaxTable {
  label: string;
}

// These calculations are deliberately versioned. Do not expose a current-pay
// estimate when the matching tax table has not been reviewed and published.
const HISTORICAL_TAX_TABLES: Partial<Record<CountryCode, HistoricalTaxTable>> = {
  UK: { label: '2024/25 UK' },
  Ireland: { label: '2024 Ireland' },
};

/**
 * Fails closed until a versioned, current payroll calculation is available.
 * A date alone is not enough: a trustworthy payslip comparison also needs the
 * right tax year, pay cadence, tax code/RPN and payroll-class assumptions.
 */
export function getTaxEstimateAvailability(
  country: CountryCode | null | undefined,
  _payslipDate?: string | null,
  _asOf: Date = new Date(),
): TaxEstimateAvailability {
  const table = country ? HISTORICAL_TAX_TABLES[country] : undefined;

  return {
    available: false,
    supportedPeriod: table?.label ?? null,
    message: table
      ? `The available ${table.label} calculation is historical and cannot safely assess a current payslip. We are reviewing a versioned payroll model before showing another estimate.`
      : 'Tax estimates are temporarily unavailable while country tax tables are being reviewed.',
  };
}
