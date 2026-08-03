export type CurrencyCode = 'GBP' | 'EUR';
export type PayslipStatus = 'uploading' | 'processing' | 'failed' | 'needs_review' | 'completed';
export type AllocationCategory = 'essential_bills' | 'everyday_spending' | 'buffer';

export interface Profile {
  user_id: string;
  first_name: string | null;
  country: 'UK' | 'Ireland' | null;
  currency: CurrencyCode | null;
  pay_frequency: 'weekly' | 'fortnightly' | 'monthly' | 'other' | null;
}

export interface Payslip {
  id: string;
  file_path: string | null;
  pay_date: string | null;
  country: 'UK' | 'Ireland' | null;
  file_name: string | null;
  status: PayslipStatus;
  processing_failure_code: string | null;
  created_at: string;
}

export interface PayslipExtraction {
  payslip_id: string;
  extraction_status: 'pending' | 'failed' | 'completed';
  confidence_score: number | null;
  gross_pay: number | string | null;
  net_pay: number | string | null;
  taxable_pay: number | string | null;
  tax_amount: number | string | null;
  national_insurance_amount: number | string | null;
  prsi_amount: number | string | null;
  usc_amount: number | string | null;
  pension_amount: number | string | null;
  total_deductions: number | string | null;
}

export interface PayslipAnomaly {
  id: string;
  payslip_id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string | null;
  suggested_action: string | null;
  status: 'new' | 'reviewed' | 'raised' | 'resolved' | null;
}

export interface ConfirmedPayslip extends Payslip {
  extraction: PayslipExtraction | null;
}

export interface PaydayPlan {
  id: string;
  user_id: string;
  payslip_id: string | null;
  pay_date: string;
  next_payday: string;
  currency: CurrencyCode;
  net_pay: number | string;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
}

export interface PlanAllocation {
  id: string;
  plan_id: string;
  category: AllocationCategory;
  amount: number | string;
}

export interface RecurringBill {
  id: string;
  name: string;
  amount: number | string;
  due_day: number | null;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'annual' | 'other';
  is_essential: boolean;
  is_active: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number | string;
  current_amount: number | string;
  currency: CurrencyCode;
  is_primary: boolean;
}

export interface MobileDashboardData {
  profile: Profile | null;
  latestPayslip: Payslip | null;
  latestExtraction: PayslipExtraction | null;
  previousExtraction: PayslipExtraction | null;
  confirmedPayslips: ConfirmedPayslip[];
  pendingPayslips: Payslip[];
  latestAnomalies: PayslipAnomaly[];
  activePlan: PaydayPlan | null;
  allocations: PlanAllocation[];
  bills: RecurringBill[];
  primaryGoal: SavingsGoal | null;
}
