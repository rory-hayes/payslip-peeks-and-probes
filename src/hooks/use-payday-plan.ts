import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type PaydayPlanAllocationKey = 'essentialBills' | 'everydaySpending' | 'buffer';

export type PaydayPlanAllocations = Record<PaydayPlanAllocationKey, number>;

export interface PaydayPlan {
  id: string;
  payslipId: string | null;
  payDate: string;
  nextPayday: string;
  currency: 'GBP' | 'EUR';
  netPay: number;
  status: string;
  updatedAt: string;
  everydayRemaining: number | null;
  everydayCheckedInAt: string | null;
  allocations: PaydayPlanAllocations;
}

export interface SavePaydayPlanInput {
  payslipId: string;
  nextPayday: string;
  allocations: PaydayPlanAllocations;
}

export interface PaydayCheckIn {
  planId: string;
  everydayRemaining: number;
  checkedInAt: string;
}

export interface SavePaydayCheckInInput {
  planId: string;
  everydayRemaining: number;
}

type AllocationRow = {
  category: string;
  amount: number | string | null;
};

type PaydayPlanRow = {
  id: string;
  payslip_id: string | null;
  pay_date: string;
  next_payday: string;
  currency: string;
  net_pay: number | string;
  status: string;
  updated_at: string;
  everyday_remaining: number | string | null;
  everyday_checked_in_at: string | null;
  payday_plan_allocations?: AllocationRow[] | null;
};

const EMPTY_ALLOCATIONS: PaydayPlanAllocations = {
  essentialBills: 0,
  everydaySpending: 0,
  buffer: 0,
};

const CATEGORY_TO_FIELD: Record<string, PaydayPlanAllocationKey> = {
  essential_bills: 'essentialBills',
  everyday_spending: 'everydaySpending',
  buffer: 'buffer',
};

function numberOrZero(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currencyOrDefault(value: string): 'GBP' | 'EUR' {
  return value === 'EUR' ? 'EUR' : 'GBP';
}

function readAllocations(rows: AllocationRow[] | null | undefined): PaydayPlanAllocations {
  return (rows ?? []).reduce<PaydayPlanAllocations>((allocations, row) => {
    const field = CATEGORY_TO_FIELD[row.category];
    if (field) allocations[field] = numberOrZero(row.amount);
    return allocations;
  }, { ...EMPTY_ALLOCATIONS });
}

function mapPaydayPlan(row: PaydayPlanRow, allocations?: PaydayPlanAllocations): PaydayPlan {
  return {
    id: row.id,
    payslipId: row.payslip_id,
    payDate: row.pay_date,
    nextPayday: row.next_payday,
    currency: currencyOrDefault(row.currency),
    netPay: numberOrZero(row.net_pay),
    status: row.status,
    updatedAt: row.updated_at,
    everydayRemaining: row.everyday_remaining == null ? null : numberOrZero(row.everyday_remaining),
    everydayCheckedInAt: row.everyday_checked_in_at ?? null,
    allocations: allocations ?? readAllocations(row.payday_plan_allocations),
  };
}

/**
 * Reads only the signed-in person's active plan. RLS is the access boundary;
 * the client deliberately does not send a user id as a filter or save input.
 */
export function useActivePaydayPlan() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['payday-plan', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<PaydayPlan | null> => {
      const { data, error } = await supabase
        .from('payday_plans')
        .select(`
          id, payslip_id, pay_date, next_payday, currency, net_pay, status, updated_at,
          everyday_remaining, everyday_checked_in_at,
          payday_plan_allocations(category, amount)
        `)
        .eq('status', 'active')
        .order('pay_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ? mapPaydayPlan(data as PaydayPlanRow) : null;
    },
  });
}

export function useSavePaydayPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SavePaydayPlanInput): Promise<PaydayPlan> => {
      if (!user) throw new Error('Sign in before saving a payday plan.');

      const { data, error } = await supabase.rpc('save_payday_plan', {
        p_payslip_id: input.payslipId,
        p_next_payday: input.nextPayday,
        p_essential_bills: input.allocations.essentialBills,
        p_everyday_spending: input.allocations.everydaySpending,
        p_buffer: input.allocations.buffer,
      });

      if (error) throw error;
      // PostgREST versions can serialise a composite RPC result as either one
      // object or a single-item collection. The server derives the payslip
      // figures; this only maps its returned result into UI data.
      const savedRow = Array.isArray(data) ? data[0] : data;
      if (!savedRow) throw new Error('Your payday plan could not be saved. Please try again.');

      return mapPaydayPlan(savedRow as PaydayPlanRow, input.allocations);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payday-plan', user?.id] });
    },
  });
}

/**
 * A check-in only records a person's manual view of the everyday money left
 * in their active plan. The RPC derives ownership and validates the plan
 * amount; the browser never supplies a user id or the original payslip data.
 */
export function useSavePaydayCheckIn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SavePaydayCheckInInput): Promise<PaydayCheckIn> => {
      if (!user) throw new Error('Sign in before saving a payday check-in.');

      const { data, error } = await supabase.rpc('save_payday_check_in', {
        p_plan_id: input.planId,
        p_everyday_remaining: input.everydayRemaining,
      });

      if (error) throw error;
      const savedRow = Array.isArray(data) ? data[0] : data;
      if (!savedRow || typeof savedRow.id !== 'string' || savedRow.everyday_remaining == null || !savedRow.everyday_checked_in_at) {
        throw new Error('Your payday check-in could not be saved. Please try again.');
      }

      return {
        planId: savedRow.id,
        everydayRemaining: numberOrZero(savedRow.everyday_remaining),
        checkedInAt: savedRow.everyday_checked_in_at,
      };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payday-plan', user?.id] });
    },
  });
}
