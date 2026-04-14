import type { Payslip, AnomalyResult, PayTrend } from './types';

/** Sample payslips for demo mode so prospective users can explore the product. */
export const DEMO_PAYSLIPS: Payslip[] = [
  {
    id: 'demo-1',
    employer_name: 'Acme Corp',
    file_name: 'payslip-jan-2026.pdf',
    pay_date: '2026-01-31',
    pay_period_start: '2026-01-01',
    pay_period_end: '2026-01-31',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 3750,
    net_pay: 2847.50,
    tax_amount: 510,
    ni_amount: 312.50,
    pension_amount: 80,
    total_deductions: 902.50,
    taxable_pay: 3750,
    anomaly_count: 0,
  },
  {
    id: 'demo-2',
    employer_name: 'Acme Corp',
    file_name: 'payslip-feb-2026.pdf',
    pay_date: '2026-02-28',
    pay_period_start: '2026-02-01',
    pay_period_end: '2026-02-28',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 3750,
    net_pay: 2847.50,
    tax_amount: 510,
    ni_amount: 312.50,
    pension_amount: 80,
    total_deductions: 902.50,
    taxable_pay: 3750,
    anomaly_count: 0,
  },
  {
    id: 'demo-3',
    employer_name: 'Acme Corp',
    file_name: 'payslip-mar-2026.pdf',
    pay_date: '2026-03-31',
    pay_period_start: '2026-03-01',
    pay_period_end: '2026-03-31',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 3750,
    net_pay: 2710.00,
    tax_amount: 640,
    ni_amount: 312.50,
    pension_amount: 87.50,
    total_deductions: 1040,
    taxable_pay: 3750,
    anomaly_count: 2,
  },
];

export const DEMO_ANOMALIES: AnomalyResult[] = [
  {
    id: 'demo-a1',
    payslip_id: 'demo-3',
    payslip_date: '2026-03-31',
    employer_name: 'Acme Corp',
    anomaly_type: 'tax_disproportionate',
    severity: 'high',
    confidence: 'high',
    title: 'Tax increased more than expected',
    description:
      'What changed: Your income tax jumped from £510.00 to £640.00 — a £130.00 increase (25.5%) — while your gross pay stayed the same.\n\nWhy it matters: This could indicate a tax code change. It's worth checking your tax code hasn't been updated incorrectly.',
    status: 'new',
    suggested_action:
      'Check the tax code on this payslip against your HMRC personal tax account. If the code changed, confirm it's correct.',
  },
  {
    id: 'demo-a2',
    payslip_id: 'demo-3',
    payslip_date: '2026-03-31',
    employer_name: 'Acme Corp',
    anomaly_type: 'same_gross_different_net',
    severity: 'medium',
    confidence: 'high',
    title: 'Same gross pay but different take-home',
    description:
      'What changed: Your gross pay is essentially the same, but your take-home pay dropped by £137.50. Something in your deductions changed.\n\nWhy it matters: When gross stays the same but net moves, a deduction was added or adjusted.',
    status: 'new',
    suggested_action:
      'Compare each deduction line against last month's payslip. Focus on tax and pension to identify what shifted.',
  },
];

export const DEMO_TRENDS: PayTrend[] = DEMO_PAYSLIPS.map((s) => ({
  month: new Date(s.pay_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
  gross: s.gross_pay,
  net: s.net_pay,
  tax: s.tax_amount,
  deductions: s.total_deductions,
}));
