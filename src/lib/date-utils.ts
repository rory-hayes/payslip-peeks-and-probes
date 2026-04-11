import { parse, isValid, format } from 'date-fns';

/**
 * Robust date parser for UK/IE payslip dates.
 * Handles ISO, DD/MM/YYYY, D/M/YYYY, textual, and mixed formats.
 * Always returns a Date in UTC-safe manner.
 */
const DATE_FORMATS = [
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'd/M/yyyy',
  'dd-MM-yyyy',
  'd-M-yyyy',
  'dd.MM.yyyy',
  'd.M.yyyy',
  'dd MMMM yyyy',
  'd MMMM yyyy',
  'dd MMM yyyy',
  'd MMM yyyy',
  'MMMM dd, yyyy',
  'MMMM d, yyyy',
  'MMM dd, yyyy',
  'MMM d, yyyy',
  'MMMM dd yyyy',
  'MMM dd yyyy',
];

export function parsePayDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // ISO with optional time — construct via UTC to avoid timezone shift
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(Date.UTC(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]));
    if (isValid(d) && d.getUTCDate() === +isoMatch[3]) return d;
  }

  // Try each date-fns format
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(trimmed, fmt, new Date(2000, 0, 1));
    if (isValid(parsed) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
      return parsed;
    }
  }

  return null;
}

/**
 * Normalise any date string to YYYY-MM-DD for database storage.
 * Returns null if the date cannot be parsed.
 */
export function normaliseToISO(input: string | null | undefined): string | null {
  const d = parsePayDate(input);
  if (!d) return null;
  // Use UTC-safe formatting for ISO dates, local for date-fns parsed
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format a date string for display, e.g. "31 Mar 2025".
 * Returns a dash if parsing fails (never "Invalid Date").
 */
export function formatDate(dateStr: string | null | undefined): string {
  const d = parsePayDate(dateStr);
  if (!d) return '—';
  return format(d, 'd MMM yyyy');
}

/**
 * Format for month labels in charts, e.g. "Oct".
 */
export function formatMonth(dateStr: string): string {
  const d = parsePayDate(dateStr);
  if (!d) return '—';
  return format(d, 'MMM yyyy');
}

/**
 * Sort key — returns ISO string for reliable ordering.
 */
export function toSortableDate(dateStr: string): string {
  const d = parsePayDate(dateStr);
  if (!d) return '0000-00-00';
  return format(d, 'yyyy-MM-dd');
}
