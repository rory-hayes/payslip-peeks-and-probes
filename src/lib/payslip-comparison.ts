import { getCountryConfig } from '@/lib/countries';
import { parsePayDate } from '@/lib/date-utils';
import type { Payslip } from '@/lib/types';

export type ComparisonSelectionIssue =
  | 'needs_review'
  | 'not_found'
  | 'same_payslip'
  | 'country_mismatch'
  | 'invalid_pay_date'
  | 'invalid_order'
  | 'needs_confirmed_history';

export type ComparisonRowKind = 'pay' | 'deduction';

export interface PayslipComparison {
  current: Payslip;
  previous: Payslip;
}

export interface PayslipComparisonSelection {
  comparison: PayslipComparison | null;
  issue: ComparisonSelectionIssue | null;
}

export interface ComparisonRow {
  label: string;
  current: number | null;
  previous: number | null;
  kind: ComparisonRowKind;
  isNetPay?: boolean;
}

export interface DeductionChange {
  label: string;
  current: number;
  previous: number;
}

function requestedId(value: string | null): string | null {
  const id = value?.trim();
  return id || null;
}

function payDateValue(payslip: Payslip): number | null {
  const date = parsePayDate(payslip.pay_date);
  return date ? date.getTime() : null;
}

function knownAmount(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function newestFirst(payslips: Payslip[]): Payslip[] {
  return [...payslips].sort((left, right) => (payDateValue(right) ?? -Infinity) - (payDateValue(left) ?? -Infinity));
}

function selectedPayslip(
  payslips: Payslip[],
  id: string | null,
): { payslip: Payslip | null; issue: ComparisonSelectionIssue | null } {
  if (!id) return { payslip: null, issue: null };

  const payslip = payslips.find((candidate) => candidate.id === id);
  if (!payslip) return { payslip: null, issue: 'not_found' };
  if (payslip.status !== 'confirmed') return { payslip: null, issue: 'needs_review' };

  return { payslip, issue: null };
}

export function comparisonIssueFor(
  current: Payslip,
  previous: Payslip,
): ComparisonSelectionIssue | null {
  if (current.status !== 'confirmed' || previous.status !== 'confirmed') return 'needs_review';
  if (current.id === previous.id) return 'same_payslip';
  if (current.country !== previous.country) return 'country_mismatch';

  const currentDate = payDateValue(current);
  const previousDate = payDateValue(previous);
  if (currentDate === null || previousDate === null) return 'invalid_pay_date';
  if (previousDate >= currentDate) return 'invalid_order';

  return null;
}

/**
 * Resolve a comparison from user-owned payslips without silently falling back
 * when a URL selects a draft or incompatible record. Comparisons are only
 * meaningful when both figures have been explicitly confirmed and use the
 * same country-specific payroll terminology.
 */
export function selectPayslipComparison(
  payslips: Payslip[],
  currentId: string | null,
  previousId: string | null,
): PayslipComparisonSelection {
  const requestedCurrentId = requestedId(currentId);
  const requestedPreviousId = requestedId(previousId);
  const resolvedCurrent = selectedPayslip(payslips, requestedCurrentId);
  if (resolvedCurrent.issue) return { comparison: null, issue: resolvedCurrent.issue };

  const confirmedWithDates = newestFirst(
    payslips.filter((payslip) => payslip.status === 'confirmed' && payDateValue(payslip) !== null),
  );
  const current = resolvedCurrent.payslip ?? confirmedWithDates[0] ?? null;
  if (!current) return { comparison: null, issue: 'needs_confirmed_history' };
  if (payDateValue(current) === null) return { comparison: null, issue: 'invalid_pay_date' };

  const resolvedPrevious = selectedPayslip(payslips, requestedPreviousId);
  if (resolvedPrevious.issue) return { comparison: null, issue: resolvedPrevious.issue };

  const previous = resolvedPrevious.payslip ?? confirmedWithDates.find((candidate) => (
    candidate.id !== current.id
      && candidate.country === current.country
      && (payDateValue(candidate) ?? Infinity) < (payDateValue(current) ?? -Infinity)
  )) ?? null;

  if (!previous) return { comparison: null, issue: 'needs_confirmed_history' };

  const issue = comparisonIssueFor(current, previous);
  if (issue) return { comparison: null, issue };

  return { comparison: { current, previous }, issue: null };
}

/**
 * Build only country-relevant deduction rows. An absent optional value stays
 * absent instead of being presented as a zero deduction.
 */
export function comparisonRowsFor(current: Payslip, previous: Payslip): ComparisonRow[] {
  const countryConfig = getCountryConfig(current.country);
  const taxLine = countryConfig.deductionLines.find((line) => line.fieldKey === 'tax_amount');
  const optionalDeductionRows = countryConfig.deductionLines
    .filter((line) => line.fieldKey !== 'tax_amount')
    .flatMap((line) => {
      const currentAmount = knownAmount(current[line.fieldKey]);
      const previousAmount = knownAmount(previous[line.fieldKey]);
      if (currentAmount === null && previousAmount === null) return [];

      return [{
        label: line.label,
        current: currentAmount,
        previous: previousAmount,
        kind: 'deduction' as const,
      }];
    });

  return [
    { label: 'Gross pay', current: knownAmount(current.gross_pay), previous: knownAmount(previous.gross_pay), kind: 'pay' },
    {
      label: taxLine?.label ?? 'Income tax',
      current: knownAmount(current.tax_amount),
      previous: knownAmount(previous.tax_amount),
      kind: 'deduction',
    },
    ...optionalDeductionRows,
    {
      label: 'Total deductions',
      current: knownAmount(current.total_deductions),
      previous: knownAmount(previous.total_deductions),
      kind: 'deduction',
    },
    { label: 'Net pay', current: knownAmount(current.net_pay), previous: knownAmount(previous.net_pay), kind: 'pay', isNetPay: true },
  ];
}

export function deductionChangesFor(current: Payslip, previous: Payslip): DeductionChange[] {
  const countryConfig = getCountryConfig(current.country);

  return countryConfig.deductionLines.flatMap((line) => {
    const currentAmount = knownAmount(current[line.fieldKey]);
    const previousAmount = knownAmount(previous[line.fieldKey]);
    if (currentAmount === null || previousAmount === null || currentAmount === previousAmount) return [];

    return [{ label: line.label, current: currentAmount, previous: previousAmount }];
  });
}

export function formatComparisonCurrency(amount: number, country: Payslip['country']): string {
  const { currency, locale } = getCountryConfig(country);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
