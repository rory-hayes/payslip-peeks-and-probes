import { getCountryConfig } from '@/lib/countries';
import type { Payslip } from '@/lib/types';

export interface YearToDateRow {
  label: string;
  value: number;
  bold?: boolean;
}

export interface YearToDateSummaryData {
  payslips: Payslip[];
  rows: YearToDateRow[];
}

/**
 * Build a transparent year-to-date summary from the deduction labels that
 * belong to each payslip's country. This avoids presenting Irish PRSI and USC
 * as UK National Insurance, and keeps historic country-specific deductions
 * visible if a user has payslips from more than one country.
 */
export function summariseYearToDate(
  payslips: Payslip[],
  currentYear: number,
): YearToDateSummaryData {
  const ytdPayslips = payslips.filter(
    (payslip) => new Date(payslip.pay_date).getFullYear() === currentYear,
  );

  const totals = ytdPayslips.reduce(
    (acc, payslip) => ({
      gross: acc.gross + payslip.gross_pay,
      net: acc.net + payslip.net_pay,
      deductions: acc.deductions + payslip.total_deductions,
    }),
    { gross: 0, net: 0, deductions: 0 },
  );

  const deductionRows = new Map<string, number>();
  ytdPayslips.forEach((payslip) => {
    getCountryConfig(payslip.country).deductionLines.forEach((line) => {
      const amount = payslip[line.fieldKey] ?? 0;
      if (amount === 0) return;

      deductionRows.set(line.label, (deductionRows.get(line.label) ?? 0) + amount);
    });
  });

  const rows: YearToDateRow[] = [
    { label: 'Gross pay', value: totals.gross },
    ...[...deductionRows.entries()].map(([label, value]) => ({ label, value })),
    { label: 'Total deductions', value: totals.deductions },
    { label: 'Net pay', value: totals.net, bold: true },
  ];

  return { payslips: ytdPayslips, rows };
}
