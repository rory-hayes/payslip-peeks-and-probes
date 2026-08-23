import { describe, expect, it } from 'vitest';
import type { Payslip } from '@/lib/types';
import { summariseYearToDate } from './year-to-date';

const currentYear = new Date().getFullYear();

const irelandPayslip: Payslip = {
  id: 'ie-jan',
  employer_name: 'Example IE Ltd',
  file_name: 'jan.pdf',
  pay_date: `${currentYear}-01-31`,
  pay_period_start: `${currentYear}-01-01`,
  pay_period_end: `${currentYear}-01-31`,
  country: 'Ireland',
  status: 'confirmed',
  gross_pay: 4000,
  net_pay: 3125,
  tax_amount: 500,
  prsi_amount: 160,
  usc_amount: 165,
  pension_amount: 50,
  total_deductions: 875,
  anomaly_count: 0,
};

describe('summariseYearToDate', () => {
  it('keeps Irish PAYE, PRSI and USC separate in the year-to-date breakdown', () => {
    const { rows } = summariseYearToDate([irelandPayslip], currentYear);

    expect(rows).toEqual([
      { label: 'Gross pay', value: 4000 },
      { label: 'PAYE', value: 500 },
      { label: 'PRSI', value: 160 },
      { label: 'USC', value: 165 },
      { label: 'Pension', value: 50 },
      { label: 'Total deductions', value: 875 },
      { label: 'Net pay', value: 3125, bold: true },
    ]);
  });

  it('excludes payslips outside the requested calendar year', () => {
    const previousYearSlip = {
      ...irelandPayslip,
      id: 'ie-old',
      pay_date: `${currentYear - 1}-12-31`,
    };

    const result = summariseYearToDate([irelandPayslip, previousYearSlip], currentYear);

    expect(result.payslips).toEqual([irelandPayslip]);
    expect(result.rows.find((row) => row.label === 'PRSI')?.value).toBe(160);
  });
});
