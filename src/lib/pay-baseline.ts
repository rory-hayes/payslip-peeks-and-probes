import type { Payslip } from './types';

type PayCadence = 'weekly' | 'fortnightly' | 'monthly' | 'other' | null;

export interface UsualPayBaseline {
  /** The result is intentionally derived only from confirmed, comparable payslips. */
  status: 'ready' | 'needs_history';
  currentPayslipId: string | null;
  /** The closest comparable payslip, suitable for the detailed compare view. */
  referencePayslipId: string | null;
  /** Number of previous confirmed payslips used to establish the usual amount. */
  sampleSize: number;
  usualNetPay: number | null;
  netDifference: number | null;
}

const UNKNOWN_EMPLOYER = 'unknown';

function parseIsoDate(value: string): Date | null {
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

function durationInDays(payslip: Payslip): number | null {
  const start = parseIsoDate(payslip.pay_period_start);
  const end = parseIsoDate(payslip.pay_period_end);
  if (!start || !end || end < start) return null;

  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function cadenceFor(payslip: Payslip): PayCadence {
  const days = durationInDays(payslip);
  if (days === null) return null;
  if (days <= 8) return 'weekly';
  if (days <= 17) return 'fortnightly';
  if (days <= 35) return 'monthly';
  return 'other';
}

function normalizedEmployerName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return normalized && normalized !== UNKNOWN_EMPLOYER ? normalized : null;
}

function isComparableToCurrent(current: Payslip, candidate: Payslip): boolean {
  if (candidate.country !== current.country) return false;

  const currentEmployer = normalizedEmployerName(current.employer_name);
  const candidateEmployer = normalizedEmployerName(candidate.employer_name);
  if (currentEmployer && candidateEmployer && currentEmployer !== candidateEmployer) return false;

  const currentCadence = cadenceFor(current);
  const candidateCadence = cadenceFor(candidate);
  return currentCadence === null || candidateCadence === null || currentCadence === candidateCadence;
}

function roundToPence(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Finds a calm, descriptive reference point for the latest pay. It deliberately
 * does not use unreviewed extractions, anomaly output, tax estimates, or a
 * client-side assumption about the "right" amount of pay.
 */
export function deriveUsualPayBaseline(payslips: Payslip[]): UsualPayBaseline {
  const confirmed = payslips
    .map((payslip) => ({ payslip, date: parseIsoDate(payslip.pay_date) }))
    .filter(({ payslip, date }) => payslip.status === 'confirmed' && payslip.net_pay > 0 && Number.isFinite(payslip.net_pay) && date !== null)
    .sort((a, b) => a.date!.getTime() - b.date!.getTime());

  const current = confirmed.at(-1)?.payslip ?? null;
  if (!current) {
    return {
      status: 'needs_history',
      currentPayslipId: null,
      referencePayslipId: null,
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
  const reference = history.at(-1) ?? null;

  if (history.length < 2) {
    return {
      status: 'needs_history',
      currentPayslipId: current.id,
      referencePayslipId: reference?.id ?? null,
      sampleSize: history.length,
      usualNetPay: null,
      netDifference: null,
    };
  }

  const usualNetPay = roundToPence(median(history.map(({ net_pay }) => net_pay)));
  return {
    status: 'ready',
    currentPayslipId: current.id,
    referencePayslipId: reference?.id ?? null,
    sampleSize: history.length,
    usualNetPay,
    netDifference: roundToPence(current.net_pay - usualNetPay),
  };
}
