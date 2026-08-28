import type { ConfirmedPayslip, MobileDashboardData, PayslipExtraction } from '../types/models';

function extraction(
  payslipId: string,
  values: Pick<PayslipExtraction, 'gross_pay' | 'net_pay' | 'tax_amount' | 'national_insurance_amount' | 'pension_amount' | 'total_deductions'>,
): PayslipExtraction {
  return {
    payslip_id: payslipId,
    extraction_status: 'completed',
    confidence_score: 0.96,
    taxable_pay: values.gross_pay,
    prsi_amount: null,
    usc_amount: null,
    ...values,
  };
}

function confirmedPayslip(
  id: string,
  date: string,
  values: Parameters<typeof extraction>[1],
): ConfirmedPayslip {
  return {
    id,
    employer_id: null,
    file_path: null,
    pay_date: date,
    pay_period_start: date.slice(0, 8) + '01',
    pay_period_end: date,
    country: 'UK',
    file_name: 'sample-' + date + '.pdf',
    status: 'completed',
    processing_failure_code: null,
    cleanup_requested_at: null,
    created_at: date + 'T12:00:00.000Z',
    extraction: extraction(id, values),
  };
}

const january = confirmedPayslip('sample-jan', '2026-01-31', {
  gross_pay: 3750,
  net_pay: 2847.5,
  tax_amount: 510,
  national_insurance_amount: 312.5,
  pension_amount: 80,
  total_deductions: 902.5,
});

const february = confirmedPayslip('sample-feb', '2026-02-28', {
  gross_pay: 3750,
  net_pay: 2847.5,
  tax_amount: 510,
  national_insurance_amount: 312.5,
  pension_amount: 80,
  total_deductions: 902.5,
});

const march = confirmedPayslip('sample-mar', '2026-03-31', {
  gross_pay: 3750,
  net_pay: 2710,
  tax_amount: 640,
  national_insurance_amount: 312.5,
  pension_amount: 87.5,
  total_deductions: 1040,
});

export const SAMPLE_MOBILE_DASHBOARD_DATA: MobileDashboardData = {
  profile: {
    user_id: 'sample-user',
    first_name: 'Sam',
    country: 'UK',
    currency: 'GBP',
    pay_frequency: 'monthly',
  },
  latestPayslip: march,
  latestExtraction: march.extraction,
  previousExtraction: february.extraction,
  confirmedPayslips: [march, february, january],
  pendingPayslips: [],
  latestAnomalies: [
    {
      id: 'sample-anomaly',
      payslip_id: march.id,
      severity: 'high',
      title: 'Tax increased more than your recent payslips.',
      description: 'Gross pay stayed the same while tax increased by £130.',
      suggested_action: 'Compare the tax code and ask payroll what changed.',
      status: 'new',
    },
  ],
  activePlan: null,
  allocations: [],
  bills: [],
  primaryGoal: null,
};
