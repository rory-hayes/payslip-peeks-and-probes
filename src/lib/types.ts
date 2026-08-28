export type Country =
  | 'UK'
  | 'Ireland'
  | 'Germany'
  | 'France'
  | 'Netherlands'
  | 'Spain'
  | 'Italy'
  | 'Belgium'
  | 'Portugal';
export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'other';
export type AnomalySeverity = 'low' | 'medium' | 'high';
export type AnomalyStatus = 'new' | 'reviewed' | 'raised' | 'resolved';
export type ReviewChecksStatus = 'pending' | 'complete' | 'failed';
export type PayslipStatus = 'uploading' | 'processing' | 'extracted' | 'confirmed' | 'failed';
export type PayslipExtractionConfidence = 'high' | 'medium' | 'low';
export type PayslipLineItemKind = 'earning' | 'deduction' | 'employer_contribution' | 'information';

export interface PayslipLineItem {
  label: string;
  kind: PayslipLineItemKind;
  amount: number | null;
  year_to_date_amount: number | null;
  evidence: string | null;
  confidence: PayslipExtractionConfidence;
  /** True after the account owner confirms this row against the original. */
  reviewed?: boolean;
}

export interface PayslipFieldEvidence {
  field: string;
  evidence: string | null;
  confidence: PayslipExtractionConfidence;
}

export interface PayslipYearToDate {
  gross_pay: number | null;
  tax: number | null;
  ni: number | null;
  pension: number | null;
}

export interface PayslipExtractionContext {
  tax_code: string | null;
  national_insurance_category: string | null;
  prsi_class: string | null;
  pay_frequency: 'weekly' | 'fortnightly' | 'four_weekly' | 'monthly' | 'annual' | 'other' | null;
  pay_basis: string | null;
}

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
  currency?: 'GBP' | 'EUR';
  extraction_confidence?: PayslipExtractionConfidence;
  extraction_line_items?: PayslipLineItem[];
  extraction_field_evidence?: PayslipFieldEvidence[];
  year_to_date?: PayslipYearToDate;
  year_to_date_reviewed?: boolean;
  extraction_context?: PayslipExtractionContext;
  extraction_context_reviewed?: boolean;
  /** Rule checks are complete only when they match review_checks_revision. */
  review_checks_status: ReviewChecksStatus;
  review_checks_revision: number;
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
