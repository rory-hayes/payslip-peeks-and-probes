export type Country =
  | 'UK'
  | 'Ireland'
  | 'Germany'
  | 'France'
  | 'Netherlands'
  | 'Spain'
  | 'Italy'
  | 'Belgium'
  | 'Portugal'
  | 'US';
export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'other';
export type AnomalySeverity = 'low' | 'medium' | 'high';
export type AnomalyStatus = 'new' | 'reviewed' | 'raised' | 'resolved';
export type PayslipStatus = 'uploading' | 'processing' | 'extracted' | 'confirmed' | 'failed';

export interface Payslip {
  id: string;
  employer_name: string;
  file_name: string;
  pay_date: string;
  pay_period_start: string;
  pay_period_end: string;
  country: Country;
  status: PayslipStatus;
  gross_pay: number;
  net_pay: number;
  tax_amount: number;
  ni_amount?: number;
  prsi_amount?: number;
  usc_amount?: number;
  /** Germany: combined employee Sozialversicherung */
  social_security_amount?: number;
  /** Germany: Solidaritätszuschlag */
  solidarity_amount?: number;
  /** Germany: Kirchensteuer */
  church_tax_amount?: number;
  pension_amount?: number;
  student_loan_amount?: number;
  bonus_amount?: number;
  overtime_amount?: number;
  total_deductions: number;
  taxable_pay?: number;
  anomaly_count: number;
}

export interface AnomalyResult {
  id: string;
  payslip_id: string;
  payslip_date: string;
  employer_name: string;
  anomaly_type: string;
  severity: AnomalySeverity;
  confidence: string;
  title: string;
  description: string;
  status: AnomalyStatus;
  suggested_action: string;
}

export interface IssueDraft {
  id: string;
  payslip_id: string;
  payslip_date: string;
  employer_name: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent';
  created_at: string;
}

export interface PayTrend {
  month: string;
  gross: number;
  net: number;
  tax: number;
  deductions: number;
}
