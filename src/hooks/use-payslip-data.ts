import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Payslip, AnomalyResult, PayTrend } from '@/lib/types';
import { formatMonth } from '@/lib/date-utils';

type NumericField = number | string | null | undefined;
type EmployerRow = { name?: string | null; payroll_email?: string | null };
type PayslipExtractionRow = {
  gross_pay?: NumericField;
  net_pay?: NumericField;
  tax_amount?: NumericField;
  national_insurance_amount?: NumericField;
  prsi_amount?: NumericField;
  usc_amount?: NumericField;
  social_security_amount?: NumericField;
  solidarity_amount?: NumericField;
  church_tax_amount?: NumericField;
  pension_amount?: NumericField;
  student_loan_amount?: NumericField;
  bonus_amount?: NumericField;
  overtime_amount?: NumericField;
  total_deductions?: NumericField;
  taxable_pay?: NumericField;
};
type PayslipRow = {
  id: string;
  file_name?: string | null;
  pay_date?: string | null;
  pay_period_start?: string | null;
  pay_period_end?: string | null;
  country?: string | null;
  status?: string | null;
  employers?: EmployerRow | EmployerRow[] | null;
  payslip_extractions?: PayslipExtractionRow[] | null;
};
type PayslipJoin = { pay_date?: string | null; employers?: EmployerRow | EmployerRow[] | null };
type AnomalyRow = {
  id: string;
  payslip_id: string;
  anomaly_type: string;
  severity: AnomalyResult['severity'];
  confidence?: string | null;
  title: string;
  description?: string | null;
  status?: AnomalyResult['status'] | null;
  suggested_action?: string | null;
  payslips?: PayslipJoin | PayslipJoin[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function numberOrZero(value: NumericField): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function optionalNumber(value: NumericField): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function countryOrDefault(value: string | null | undefined): Payslip['country'] {
  const countries: Payslip['country'][] = ['UK', 'Ireland', 'Germany', 'France', 'Netherlands', 'Spain', 'Italy', 'Belgium', 'Portugal'];
  return countries.includes(value as Payslip['country']) ? value as Payslip['country'] : 'UK';
}

// The database lifecycle names differ from the consumer UI vocabulary: a
// completed review is a confirmed payslip, while a payslip awaiting review is
// an extracted one. Keep this translation at the data boundary so a server
// status can never be mistaken for a confirmed figure in the UI.
export function normalizePayslipStatus(value: string | null | undefined): Payslip['status'] {
  if (value === 'completed') return 'confirmed';
  if (value === 'needs_review') return 'extracted';

  const statuses: Payslip['status'][] = ['uploading', 'processing', 'extracted', 'confirmed', 'failed'];
  return statuses.includes(value as Payslip['status']) ? value as Payslip['status'] : 'processing';
}

export function usePayslips() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['payslips', user?.id],
    queryFn: async (): Promise<Payslip[]> => {
      const { data: payslips, error } = await supabase
        .from('payslips')
        .select(`
          id, file_name, pay_date, pay_period_start, pay_period_end, country, status,
          employer_id,
          employers(name, payroll_email),
          payslip_extractions(
            gross_pay, net_pay, tax_amount, national_insurance_amount,
            prsi_amount, usc_amount, social_security_amount, solidarity_amount, church_tax_amount,
            pension_amount, student_loan_amount,
            bonus_amount, overtime_amount, total_deductions, taxable_pay
          )
        `)
        .eq('user_id', user!.id)
        .order('pay_date', { ascending: true });

      if (error) throw error;

      // Count anomalies per payslip
      const { data: anomalyCounts, error: anomalyCountsError } = await supabase
        .from('anomaly_results')
        .select('payslip_id')
        .eq('status', 'new');

      if (anomalyCountsError) throw anomalyCountsError;

      const countMap: Record<string, number> = {};
      anomalyCounts?.forEach((a) => {
        countMap[a.payslip_id] = (countMap[a.payslip_id] || 0) + 1;
      });

      const rows = (payslips ?? []) as unknown as PayslipRow[];
      return rows.map((p) => {
        const ext = p.payslip_extractions?.[0] ?? {};
        const employer = firstRelation(p.employers);
        return {
          id: p.id,
          employer_name: employer?.name || 'Unknown',
          file_name: p.file_name || '',
          pay_date: p.pay_date || '',
          pay_period_start: p.pay_period_start || '',
          pay_period_end: p.pay_period_end || '',
          country: countryOrDefault(p.country),
          status: normalizePayslipStatus(p.status),
          gross_pay: numberOrZero(ext.gross_pay),
          net_pay: numberOrZero(ext.net_pay),
          tax_amount: numberOrZero(ext.tax_amount),
          ni_amount: optionalNumber(ext.national_insurance_amount),
          prsi_amount: optionalNumber(ext.prsi_amount),
          usc_amount: optionalNumber(ext.usc_amount),
          social_security_amount: optionalNumber(ext.social_security_amount),
          solidarity_amount: optionalNumber(ext.solidarity_amount),
          church_tax_amount: optionalNumber(ext.church_tax_amount),
          pension_amount: optionalNumber(ext.pension_amount),
          student_loan_amount: optionalNumber(ext.student_loan_amount),
          bonus_amount: optionalNumber(ext.bonus_amount),
          overtime_amount: optionalNumber(ext.overtime_amount),
          total_deductions: numberOrZero(ext.total_deductions),
          taxable_pay: optionalNumber(ext.taxable_pay),
          anomaly_count: countMap[p.id] || 0,
        } as Payslip;
      });
    },
    enabled: !!user,
  });
}

export function usePayslip(id: string | undefined) {
  const { data: payslips, isLoading, error } = usePayslips();
  const slip = payslips?.find((s) => s.id === id);
  return { data: slip, isLoading, error };
}

export function useAnomalies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['anomalies', user?.id],
    queryFn: async (): Promise<AnomalyResult[]> => {
      const { data, error } = await supabase
        .from('anomaly_results')
        .select(`
          id, payslip_id, anomaly_type, severity, confidence, title, description,
          status, suggested_action, created_at,
          payslips!inner(pay_date, user_id, employers(name))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as unknown as AnomalyRow[];
      return rows.map((a) => {
        const payslip = firstRelation(a.payslips);
        const employer = firstRelation(payslip?.employers);
        return {
          id: a.id,
          payslip_id: a.payslip_id,
          payslip_date: payslip?.pay_date || '',
          employer_name: employer?.name || 'Unknown',
          anomaly_type: a.anomaly_type,
          severity: a.severity,
          confidence: a.confidence || 'medium',
          title: a.title,
          description: a.description || '',
          status: a.status || 'new',
          suggested_action: a.suggested_action || '',
        };
      });
    },
    enabled: !!user,
  });
}

export function usePayTrends(): { data: PayTrend[] | undefined; isLoading: boolean } {
  const { data: payslips, isLoading } = usePayslips();
  const trends = payslips?.filter((payslip) => payslip.status === 'confirmed').map((s) => ({
    month: formatMonth(s.pay_date),
    gross: s.gross_pay,
    net: s.net_pay,
    tax: s.tax_amount,
    deductions: s.total_deductions,
  }));
  return { data: trends, isLoading };
}
