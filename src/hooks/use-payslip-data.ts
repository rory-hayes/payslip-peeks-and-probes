import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Payslip, AnomalyResult, PayTrend } from '@/lib/types';
import { formatMonth } from '@/lib/date-utils';

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
            prsi_amount, usc_amount, pension_amount, student_loan_amount,
            bonus_amount, overtime_amount, total_deductions, taxable_pay
          )
        `)
        .eq('user_id', user!.id)
        .order('pay_date', { ascending: true });

      if (error) throw error;

      // Count anomalies per payslip
      const { data: anomalyCounts } = await supabase
        .from('anomaly_results')
        .select('payslip_id');

      const countMap: Record<string, number> = {};
      anomalyCounts?.forEach((a) => {
        countMap[a.payslip_id] = (countMap[a.payslip_id] || 0) + 1;
      });

      return (payslips || []).map((p: any) => {
        const ext = p.payslip_extractions?.[0] || {};
        const employer = p.employers;
        return {
          id: p.id,
          employer_name: employer?.name || 'Unknown',
          file_name: p.file_name || '',
          pay_date: p.pay_date || '',
          pay_period_start: p.pay_period_start || '',
          pay_period_end: p.pay_period_end || '',
          country: (p.country || 'UK') as 'UK' | 'Ireland',
          status: p.status || 'processing',
          gross_pay: Number(ext.gross_pay) || 0,
          net_pay: Number(ext.net_pay) || 0,
          tax_amount: Number(ext.tax_amount) || 0,
          ni_amount: ext.national_insurance_amount ? Number(ext.national_insurance_amount) : undefined,
          prsi_amount: ext.prsi_amount ? Number(ext.prsi_amount) : undefined,
          usc_amount: ext.usc_amount ? Number(ext.usc_amount) : undefined,
          pension_amount: ext.pension_amount ? Number(ext.pension_amount) : undefined,
          student_loan_amount: ext.student_loan_amount ? Number(ext.student_loan_amount) : undefined,
          bonus_amount: ext.bonus_amount ? Number(ext.bonus_amount) : undefined,
          overtime_amount: ext.overtime_amount ? Number(ext.overtime_amount) : undefined,
          total_deductions: Number(ext.total_deductions) || 0,
          taxable_pay: ext.taxable_pay ? Number(ext.taxable_pay) : undefined,
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

      return (data || []).map((a: any) => ({
        id: a.id,
        payslip_id: a.payslip_id,
        payslip_date: a.payslips?.pay_date || '',
        employer_name: a.payslips?.employers?.name || 'Unknown',
        anomaly_type: a.anomaly_type,
        severity: a.severity as AnomalyResult['severity'],
        confidence: a.confidence || 'medium',
        title: a.title,
        description: a.description || '',
        status: (a.status || 'new') as AnomalyResult['status'],
        suggested_action: a.suggested_action || '',
      }));
    },
    enabled: !!user,
  });
}

export function usePayTrends(): { data: PayTrend[] | undefined; isLoading: boolean } {
  const { data: payslips, isLoading } = usePayslips();
  const trends = payslips?.map((s) => ({
    month: formatMonth(s.pay_date),
    gross: s.gross_pay,
    net: s.net_pay,
    tax: s.tax_amount,
    deductions: s.total_deductions,
  }));
  return { data: trends, isLoading };
}
