import { asNumber } from './format';
import type { ConfirmedPayslip } from '../types/models';

type PayCadence = 'weekly' | 'fortnightly' | 'monthly' | 'other';

export interface UsualPayBaseline {
  /** A completed mobile record has crossed the review-confirmation boundary. */
  status: 'ready' | 'needs_history';
  currentPayslipId: string | null;
  /** Number of comparable, confirmed payslips that came before the current one. */
  sampleSize: number;
  usualNetPay: number | null;
  netDifference: number | null;
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function cadenceFor(payslip: ConfirmedPayslip): PayCadence | null {
  const periodStart = parseIsoDate(payslip.pay_period_start);
  const periodEnd = parseIsoDate(payslip.pay_period_end);
  if (!periodStart || !periodEnd || periodEnd < periodStart) return null;

  const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1;
  if (days <= 8) return 'weekly';
  if (days <= 17) return 'fortnightly';
  if (days <= 35) return 'monthly';
  return 'other';
}

function isConfirmedWithUsableNetPay(payslip: ConfirmedPayslip): boolean {
  // `completed` is only set by confirm_payslip_review. Do not allow raw,
  // provider-derived or in-review figures into this personal reference.
  if (payslip.status !== 'completed' || payslip.extraction?.extraction_status !== 'completed') return false;
  const netPay = asNumber(payslip.extraction.net_pay);
  return netPay > 0 && Number.isFinite(netPay);
}

function isComparableToCurrent(current: ConfirmedPayslip, candidate: ConfirmedPayslip): boolean {
  if (!current.country || current.country !== candidate.country) return false;

  // Employer IDs are stronger than an extracted name. When both are known,
  // never mix pay from different employers; when either is absent, do not
  // invent an employer match from incomplete data.
  if (current.employer_id && candidate.employer_id && current.employer_id !== candidate.employer_id) return false;

  const currentCadence = cadenceFor(current);
  const candidateCadence = cadenceFor(candidate);
  return currentCadence !== null && currentCadence === candidateCadence;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function toMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Produces a descriptive take-home reference from the latest user-confirmed
 * payslip and up to three comparable confirmed records before it. This is not
 * an expected-pay calculation or a verdict about any payroll value.
 */
export function deriveUsualPayBaseline(payslips: ConfirmedPayslip[]): UsualPayBaseline {
  const confirmed = payslips
    .map((payslip) => ({ payslip, date: parseIsoDate(payslip.pay_date) }))
    .filter(({ payslip, date }) => date !== null && isConfirmedWithUsableNetPay(payslip))
    .sort((left, right) => left.date!.getTime() - right.date!.getTime());

  const current = confirmed.at(-1)?.payslip ?? null;
  if (!current) {
    return {
      status: 'needs_history',
      currentPayslipId: null,
      sampleSize: 0,
      usualNetPay: null,
      netDifference: null,
    };
  }

  const history = confirmed
    .slice(0, -1)
    .map(({ payslip }) => payslip)
    .filter((candidate) => isComparableToCurrent(current, candidate))
    .slice(-3);

  if (history.length < 2) {
    return {
      status: 'needs_history',
      currentPayslipId: current.id,
      sampleSize: history.length,
      usualNetPay: null,
      netDifference: null,
    };
  }

  const usualNetPay = toMoney(median(history.map(({ extraction }) => asNumber(extraction!.net_pay))));
  return {
    status: 'ready',
    currentPayslipId: current.id,
    sampleSize: history.length,
    usualNetPay,
    netDifference: toMoney(asNumber(current.extraction!.net_pay) - usualNetPay),
  };
}
