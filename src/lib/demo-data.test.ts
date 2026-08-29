import { describe, expect, it } from 'vitest';
import {
  DEMO_IRELAND_PAYSLIPS,
  DEMO_PAYSLIPS,
  DEMO_TAX_PAYSLIPS,
  DEMO_UK_CURRENT_TAX_PAYSLIPS,
} from './demo-data';

describe('demo payslip data', () => {
  it('keeps the payday dashboard sample in one UK currency', () => {
    expect(DEMO_PAYSLIPS).toHaveLength(3);
    expect(DEMO_PAYSLIPS.every((payslip) => (
      payslip.country === 'UK' && payslip.currency === 'GBP'
    ))).toBe(true);
  });

  it('gives the Irish tax helper complete current and completed-year evidence', () => {
    expect(DEMO_IRELAND_PAYSLIPS.filter((payslip) => payslip.pay_date.startsWith('2025-'))).toHaveLength(3);
    expect(DEMO_IRELAND_PAYSLIPS.filter((payslip) => payslip.pay_date.startsWith('2026-'))).toHaveLength(3);

    for (const payslip of DEMO_IRELAND_PAYSLIPS) {
      expect(payslip.country).toBe('Ireland');
      expect(payslip.currency).toBe('EUR');
      expect(payslip.net_pay).toBe(payslip.gross_pay - payslip.total_deductions);
      expect((payslip.pension_amount ?? 0)).toBeGreaterThan(0);
    }
  });

  it('gives the tax helper a separate populated current UK tax year', () => {
    expect(DEMO_UK_CURRENT_TAX_PAYSLIPS).toHaveLength(3);
    expect(DEMO_UK_CURRENT_TAX_PAYSLIPS.every((payslip) => (
      payslip.country === 'UK'
      && payslip.currency === 'GBP'
      && payslip.pay_date >= '2026-04-06'
      && payslip.pay_date <= '2027-04-05'
      && payslip.net_pay === payslip.gross_pay - payslip.total_deductions
    ))).toBe(true);
  });

  it('combines both countries only for country-filtered tax-helper use', () => {
    expect(DEMO_TAX_PAYSLIPS).toHaveLength(
      DEMO_PAYSLIPS.length + DEMO_IRELAND_PAYSLIPS.length + DEMO_UK_CURRENT_TAX_PAYSLIPS.length,
    );
    expect(new Set(DEMO_TAX_PAYSLIPS.map((payslip) => payslip.id)).size).toBe(DEMO_TAX_PAYSLIPS.length);
  });
});
