import { parse, isValid, format } from 'date-fns';

/**
 * Robust date parser that handles:
 * - ISO (YYYY-MM-DD)
 * - DD/MM/YYYY, DD-MM-YYYY
 * - Textual ("31 March 2026", "March 31, 2026")
 * - Already-valid Date strings
 */
const DATE_FORMATS = [
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'dd-MM-yyyy',
  'dd MMMM yyyy',
  'dd MMM yyyy',
  'MMMM dd, yyyy',
  'MMM dd, yyyy',
  'd MMMM yyyy',
  'd MMM yyyy',
  'MM/dd/yyyy',
];

export function parsePayDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try native parse first (handles ISO)
  const native = new Date(trimmed);
  if (isValid(native) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return native;
  }

  // Try each format
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(trimmed, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }

  // Last resort: native parse
  if (isValid(native)) return native;

  return null;
}

/**
 * Format a date string for display, e.g. "31 Oct 2025".
 * Returns "Unknown date" if parsing fails.
 */
export function formatDate(dateStr: string | null | undefined): string {
  const d = parsePayDate(dateStr);
  if (!d) return 'Unknown date';
  return format(d, 'd MMM yyyy');
}

/**
 * Format for month labels in charts, e.g. "Oct".
 */
export function formatMonth(dateStr: string): string {
  const d = parsePayDate(dateStr);
  if (!d) return '?';
  return format(d, 'MMM');
}

/**
 * Sort key — returns ISO string for reliable ordering.
 */
export function toSortableDate(dateStr: string): string {
  const d = parsePayDate(dateStr);
  if (!d) return '0000-00-00';
  return format(d, 'yyyy-MM-dd');
}
