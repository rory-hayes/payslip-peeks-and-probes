import type { CurrencyCode } from '../types/models';

export function asNumber(value: number | string | null | undefined): number {
  const result = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function formatMoney(value: number | string | null | undefined, currency: CurrencyCode = 'GBP'): string {
  const locale = currency === 'EUR' ? 'en-IE' : 'en-GB';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value));
}

export function formatShortMoney(value: number | string | null | undefined, currency: CurrencyCode = 'GBP'): string {
  const amount = asNumber(value);
  const symbol = currency === 'EUR' ? '€' : '£';
  return `${symbol}${new Intl.NumberFormat(currency === 'EUR' ? 'en-IE' : 'en-GB', {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return 'Not set';
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function daysUntil(date: string): number {
  const next = new Date(`${date}T12:00:00`).getTime();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.ceil((next - today.getTime()) / 86_400_000));
}

export function inferNextPayday(payDate: string, frequency: string | null | undefined): string {
  const next = new Date(`${payDate}T12:00:00`);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'fortnightly') next.setDate(next.getDate() + 14);
  else if (frequency === 'monthly') {
    // Setting 31 January directly to the next month spills into March. Anchor
    // the first of the target month, then clamp the original day to its last.
    const originalDay = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  }
  else next.setDate(next.getDate() + 28);
  return toIsoDate(next);
}
