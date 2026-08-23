import type { Payslip } from '@/lib/types';

const DAY_IN_MS = 86_400_000;

function isoDateToUtcTime(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.getTime()
    : null;
}

function isoDateFromUtcTime(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function todayInLocalCalendar(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidIsoDate(value: string): boolean {
  return isoDateToUtcTime(value) !== null;
}

export function isIsoDateAfter(value: string, reference: string): boolean {
  const valueTime = isoDateToUtcTime(value);
  const referenceTime = isoDateToUtcTime(reference);
  return valueTime !== null && referenceTime !== null && valueTime > referenceTime;
}

export function addDaysToIsoDate(value: string, days: number): string {
  const dateTime = isoDateToUtcTime(value);
  return dateTime === null ? '' : isoDateFromUtcTime(dateTime + days * DAY_IN_MS);
}

/**
 * Returns the number of calendar days from a local calendar date to an ISO
 * date. This deliberately does not use a 24-hour duration so daylight-saving
 * changes cannot make a payday appear a day nearer or further away.
 */
export function calendarDaysUntilIsoDate(value: string, today = todayInLocalCalendar()): number | null {
  const valueTime = isoDateToUtcTime(value);
  const todayTime = isoDateToUtcTime(today);
  if (valueTime === null || todayTime === null) return null;
  return Math.round((valueTime - todayTime) / DAY_IN_MS);
}

/**
 * Turns the amount deliberately set aside for everyday spending into a simple
 * per-day planning guide. A missing, current-day, or past payday never gets a
 * made-up guide; this is not a bank balance or a forecast of actual spending.
 */
export function everydaySpendingGuide(amount: number, nextPayday: string, today = todayInLocalCalendar()): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;

  const daysUntilPayday = calendarDaysUntilIsoDate(nextPayday, today);
  if (daysUntilPayday === null || daysUntilPayday <= 0) return null;

  return amount / daysUntilPayday;
}

/**
 * Suggest the next pay date from confirmed payslip dates only. The suggestion
 * is deliberately editable: a pay frequency can change and a plan should
 * never silently assert a future payday.
 */
function fallbackCadenceDays(payFrequency: string | null | undefined): number {
  if (payFrequency === 'weekly') return 7;
  if (payFrequency === 'fortnightly') return 14;
  return 30;
}

export function inferNextPayday(
  latestPayslip: Payslip,
  payslips: Payslip[],
  today = todayInLocalCalendar(),
  payFrequency?: string | null,
): string {
  const latestDate = isoDateToUtcTime(latestPayslip.pay_date);
  const todayDate = isoDateToUtcTime(today);
  if (latestDate === null || todayDate === null) return '';

  const previousDate = payslips
    .filter((payslip) => payslip.id !== latestPayslip.id && payslip.status === 'confirmed')
    .map((payslip) => isoDateToUtcTime(payslip.pay_date))
    .filter((value): value is number => value !== null && value < latestDate)
    .sort((a, b) => b - a)[0];

  const inferredInterval = previousDate ? Math.round((latestDate - previousDate) / DAY_IN_MS) : null;
  // History is the strongest signal. For a first confirmed payslip, use the
  // rhythm the customer gave us during setup rather than silently assuming a
  // monthly cycle. An unusual history interval still falls back safely.
  const cadenceDays = inferredInterval !== null && inferredInterval >= 7 && inferredInterval <= 62
    ? inferredInterval
    : fallbackCadenceDays(payFrequency);
  let nextDate = latestDate + cadenceDays * DAY_IN_MS;

  // A historical payslip should still open a useful current plan rather than
  // pre-filling a deadline that has already passed.
  while (nextDate <= todayDate) nextDate += cadenceDays * DAY_IN_MS;

  return isoDateFromUtcTime(nextDate);
}
