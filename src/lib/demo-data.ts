import type { Payslip, AnomalyResult, IssueDraft, PayTrend } from './types';

export const demoPayslips: Payslip[] = [
  {
    id: 'ps-001',
    employer_name: 'Acme Technologies Ltd',
    file_name: 'payslip-oct-2025.pdf',
    pay_date: '2025-10-31',
    pay_period_start: '2025-10-01',
    pay_period_end: '2025-10-31',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 3750,
    net_pay: 2737,
    tax_amount: 491,
    ni_amount: 372,
    pension_amount: 150,
    total_deductions: 1013,
    taxable_pay: 3600,
    anomaly_count: 0,
  },
  {
    id: 'ps-002',
    employer_name: 'Acme Technologies Ltd',
    file_name: 'payslip-nov-2025.pdf',
    pay_date: '2025-11-30',
    pay_period_start: '2025-11-01',
    pay_period_end: '2025-11-30',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 3750,
    net_pay: 2742,
    tax_amount: 486,
    ni_amount: 372,
    pension_amount: 150,
    total_deductions: 1008,
    taxable_pay: 3600,
    anomaly_count: 0,
  },
  {
    id: 'ps-003',
    employer_name: 'Acme Technologies Ltd',
    file_name: 'payslip-dec-2025.pdf',
    pay_date: '2025-12-31',
    pay_period_start: '2025-12-01',
    pay_period_end: '2025-12-31',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 5250,
    net_pay: 3612,
    tax_amount: 891,
    ni_amount: 522,
    pension_amount: 225,
    bonus_amount: 1500,
    total_deductions: 1638,
    taxable_pay: 5025,
    anomaly_count: 1,
  },
  {
    id: 'ps-004',
    employer_name: 'Acme Technologies Ltd',
    file_name: 'payslip-jan-2026.pdf',
    pay_date: '2026-01-31',
    pay_period_start: '2026-01-01',
    pay_period_end: '2026-01-31',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 3750,
    net_pay: 2680,
    tax_amount: 548,
    ni_amount: 372,
    pension_amount: 150,
    total_deductions: 1070,
    taxable_pay: 3600,
    anomaly_count: 1,
  },
  {
    id: 'ps-005',
    employer_name: 'Acme Technologies Ltd',
    file_name: 'payslip-feb-2026.pdf',
    pay_date: '2026-02-28',
    pay_period_start: '2026-02-01',
    pay_period_end: '2026-02-28',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 3750,
    net_pay: 2695,
    tax_amount: 491,
    ni_amount: 414,
    pension_amount: 150,
    total_deductions: 1055,
    taxable_pay: 3600,
    anomaly_count: 1,
  },
  {
    id: 'ps-006',
    employer_name: 'Acme Technologies Ltd',
    file_name: 'payslip-mar-2026.pdf',
    pay_date: '2026-03-31',
    pay_period_start: '2026-03-01',
    pay_period_end: '2026-03-31',
    country: 'UK',
    status: 'confirmed',
    gross_pay: 3750,
    net_pay: 2540,
    tax_amount: 491,
    ni_amount: 372,
    pension_amount: 150,
    student_loan_amount: 197,
    total_deductions: 1210,
    taxable_pay: 3600,
    anomaly_count: 2,
  },
];

export const demoAnomalies: AnomalyResult[] = [
  {
    id: 'an-001',
    payslip_id: 'ps-003',
    payslip_date: '2025-12-31',
    employer_name: 'Acme Technologies Ltd',
    anomaly_type: 'bonus_tax_rate',
    severity: 'medium',
    confidence: 'medium',
    title: 'Bonus tax deduction looks higher than expected',
    description: 'Your December payslip includes a £1,500 bonus, but the tax increase (£400 above your usual £491) appears higher than the standard rate. This may be correct if your employer applies emergency tax to bonuses, but it\'s worth checking.',
    status: 'reviewed',
    suggested_action: 'Check with payroll whether the bonus was taxed at the correct marginal rate or if emergency tax was applied.',
  },
  {
    id: 'an-002',
    payslip_id: 'ps-004',
    payslip_date: '2026-01-31',
    employer_name: 'Acme Technologies Ltd',
    anomaly_type: 'tax_code_change',
    severity: 'high',
    confidence: 'high',
    title: 'Tax amount increased without a change in gross pay',
    description: 'Your January tax deduction is £548, up from your usual £491 — but your gross pay stayed the same at £3,750. This could indicate a tax code change. If you haven\'t received a tax code notice from HMRC, this may need investigating.',
    status: 'new',
    suggested_action: 'Check your latest tax code on your personal tax account at gov.uk, and ask payroll to confirm which tax code they\'re using.',
  },
  {
    id: 'an-003',
    payslip_id: 'ps-005',
    payslip_date: '2026-02-28',
    employer_name: 'Acme Technologies Ltd',
    anomaly_type: 'ni_change',
    severity: 'medium',
    confidence: 'medium',
    title: 'National Insurance increased unexpectedly',
    description: 'Your NI contribution jumped from £372 to £414 this month, despite your gross pay remaining at £3,750. NI rates occasionally change in the new tax year, but a mid-year change is unusual and may indicate an error.',
    status: 'new',
    suggested_action: 'Ask payroll to confirm the NI category letter being used and whether the rate has changed.',
  },
  {
    id: 'an-004',
    payslip_id: 'ps-006',
    payslip_date: '2026-03-31',
    employer_name: 'Acme Technologies Ltd',
    anomaly_type: 'new_deduction',
    severity: 'low',
    confidence: 'high',
    title: 'New deduction: Student Loan repayment started',
    description: 'A student loan repayment of £197 appeared on your March payslip for the first time. If you\'ve recently crossed the repayment threshold or started a new plan, this may be expected. Otherwise, confirm with payroll.',
    status: 'new',
    suggested_action: 'If you don\'t have a student loan, or believe you\'ve already repaid it, contact SLC and your payroll team.',
  },
  {
    id: 'an-005',
    payslip_id: 'ps-006',
    payslip_date: '2026-03-31',
    employer_name: 'Acme Technologies Ltd',
    anomaly_type: 'net_pay_drop',
    severity: 'high',
    confidence: 'high',
    title: 'Net pay decreased by £155 from last month',
    description: 'Your net pay dropped from £2,695 to £2,540 — a £155 decrease. This appears to be mainly due to the new student loan deduction (£197). NI also returned to the previous level (£372). The overall change is broadly consistent, but the combined effect is significant.',
    status: 'new',
    suggested_action: 'Review the breakdown to ensure all deductions are expected. If the student loan deduction is unexpected, raise it with payroll.',
  },
];

export const demoIssueDrafts: IssueDraft[] = [
  {
    id: 'dr-001',
    payslip_id: 'ps-004',
    payslip_date: '2026-01-31',
    employer_name: 'Acme Technologies Ltd',
    subject: 'Query: Increased tax deduction on January payslip',
    body: `Dear Payroll Team,

I'm writing regarding my January 2026 payslip (dated 31 January 2026).

I noticed that my income tax deduction increased from £491 to £548, despite my gross pay remaining at £3,750. This represents an increase of approximately £57.

Could you please confirm:
1. Whether my tax code has changed, and if so, what it was updated to?
2. Whether this change was applied following a notification from HMRC?

I'd appreciate any clarification on this. Happy to discuss further if needed.

Kind regards`,
    status: 'draft',
    created_at: '2026-02-05T10:30:00Z',
  },
];

export const demoPayTrends: PayTrend[] = [
  { month: 'Oct', gross: 3750, net: 2737, tax: 491, deductions: 1013 },
  { month: 'Nov', gross: 3750, net: 2742, tax: 486, deductions: 1008 },
  { month: 'Dec', gross: 5250, net: 3612, tax: 891, deductions: 1638 },
  { month: 'Jan', gross: 3750, net: 2680, tax: 548, deductions: 1070 },
  { month: 'Feb', gross: 3750, net: 2695, tax: 491, deductions: 1055 },
  { month: 'Mar', gross: 3750, net: 2540, tax: 491, deductions: 1210 },
];

export const formatCurrency = (amount: number, country: 'UK' | 'Ireland' = 'UK') => {
  return country === 'Ireland'
    ? `€${amount.toLocaleString('en-IE', { minimumFractionDigits: 2 })}`
    : `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
};

export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};
