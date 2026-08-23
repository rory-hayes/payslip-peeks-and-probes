import type { ConfirmedPayslip, CurrencyCode, PayslipExtraction } from '../types/models';

export type PayHistoryMetricId = 'gross_pay' | 'net_pay' | 'total_deductions' | 'tax_amount' | 'national_insurance_amount' | 'prsi_amount' | 'usc_amount' | 'pension_amount';

export interface PayHistoryMetric {
  id: PayHistoryMetricId;
  label: string;
  current: number | null;
  previous: number | null;
  difference: number | null;
}

export interface PayHistoryComparison {
  country: 'UK' | 'Ireland' | null;
  previousPayslip: ConfirmedPayslip | null;
  metrics: PayHistoryMetric[];
}

const METRICS: Array<{ id: PayHistoryMetricId; label: string }> = [
  { id: 'net_pay', label: 'Net pay' },
  { id: 'gross_pay', label: 'Gross pay' },
  { id: 'total_deductions', label: 'Total deductions' },
  { id: 'tax_amount', label: 'Income tax' },
  { id: 'national_insurance_amount', label: 'National Insurance' },
  { id: 'prsi_amount', label: 'PRSI' },
  { id: 'usc_amount', label: 'USC' },
  { id: 'pension_amount', label: 'Pension' },
];

function parsePayDate(value: string | null): number | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3])
    ? timestamp
    : null;
}

function amount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function confirmedFigure(extraction: PayslipExtraction | null, metric: PayHistoryMetricId): number | null {
  if (extraction?.extraction_status !== 'completed') return null;
  return amount(extraction[metric]);
}

function isConfirmed(payslip: ConfirmedPayslip): boolean {
  return payslip.status === 'completed';
}

export function confirmedPayslipAmount(payslip: ConfirmedPayslip, metric: PayHistoryMetricId): number | null {
  return isConfirmed(payslip) ? confirmedFigure(payslip.extraction, metric) : null;
}

/**
 * Uses only a confirmed record with an earlier pay date in the same country.
 * It intentionally does not infer an employer, cadence, tax position, or
 * expected pay; the detail screen is descriptive history, not advice.
 */
export function findPreviousSameCountryConfirmedPayslip(
  current: ConfirmedPayslip,
  payslips: ConfirmedPayslip[],
): ConfirmedPayslip | null {
  const currentDate = parsePayDate(current.pay_date);
  if (!current.country || currentDate === null || !isConfirmed(current)) return null;

  return payslips
    .map((candidate) => ({ candidate, payDate: parsePayDate(candidate.pay_date) }))
    .filter(({ candidate, payDate }) => (
      candidate.id !== current.id
      && candidate.country === current.country
      && isConfirmed(candidate)
      && payDate !== null
      && payDate < currentDate
    ))
    .sort((left, right) => right.payDate! - left.payDate!)[0]?.candidate ?? null;
}

export function buildPayHistoryComparison(
  current: ConfirmedPayslip,
  payslips: ConfirmedPayslip[],
): PayHistoryComparison {
  const previousPayslip = findPreviousSameCountryConfirmedPayslip(current, payslips);

  return {
    country: current.country,
    previousPayslip,
    metrics: METRICS.map(({ id, label }) => {
      const currentAmount = confirmedPayslipAmount(current, id);
      const previousAmount = previousPayslip ? confirmedPayslipAmount(previousPayslip, id) : null;
      return {
        id,
        label,
        current: currentAmount,
        previous: previousAmount,
        difference: currentAmount === null || previousAmount === null ? null : currentAmount - previousAmount,
      };
    }),
  };
}

export function currencyForPayslip(country: ConfirmedPayslip['country'], fallback: CurrencyCode): CurrencyCode {
  if (country === 'Ireland') return 'EUR';
  if (country === 'UK') return 'GBP';
  return fallback;
}
