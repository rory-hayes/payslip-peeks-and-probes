import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type BufferGoalCurrency = 'GBP' | 'EUR';

export interface BufferGoal {
  id: string;
  currency: BufferGoalCurrency;
  currentAmount: number;
  targetAmount: number;
  updatedAt: string;
}

export interface SaveBufferGoalInput {
  currency: BufferGoalCurrency;
  currentAmount: number;
  targetAmount: number;
}

type BufferGoalRow = {
  currency: string;
  current_amount: number | string;
  id: string;
  target_amount: number | string;
  updated_at: string;
};

function amountOrZero(value: number | string | null | undefined): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function currencyOrDefault(value: string): BufferGoalCurrency {
  return value === 'EUR' ? 'EUR' : 'GBP';
}

function mapBufferGoal(row: BufferGoalRow): BufferGoal {
  return {
    currency: currencyOrDefault(row.currency),
    currentAmount: amountOrZero(row.current_amount),
    id: row.id,
    targetAmount: amountOrZero(row.target_amount),
    updatedAt: row.updated_at,
  };
}

function assertValidGoal(input: SaveBufferGoalInput): void {
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error('Choose a buffer target greater than zero.');
  }

  if (!Number.isFinite(input.currentAmount) || input.currentAmount < 0) {
    throw new Error('Check the amount you have already set aside.');
  }
}

/**
 * The one-payday buffer is deliberately a manual planning goal. It never
 * claims to know a bank balance or moves money; RLS confines it to the
 * signed-in customer.
 */
export function usePrimaryBufferGoal() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['primary-buffer-goal', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<BufferGoal | null> => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('id, target_amount, current_amount, currency, updated_at')
        .eq('is_primary', true)
        .maybeSingle();

      if (error) throw error;
      return data ? mapBufferGoal(data as BufferGoalRow) : null;
    },
  });
}

export function useSavePrimaryBufferGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveBufferGoalInput): Promise<BufferGoal> => {
      if (!user) throw new Error('Sign in before saving a buffer goal.');
      assertValidGoal(input);

      const { data: existing, error: existingError } = await supabase
        .from('savings_goals')
        .select('id')
        .eq('is_primary', true)
        .maybeSingle();

      if (existingError) throw existingError;

      const values = {
        currency: input.currency,
        current_amount: input.currentAmount,
        is_primary: true,
        name: 'One-payday buffer',
        target_amount: input.targetAmount,
        user_id: user.id,
      };

      const result = existing?.id
        ? await supabase
          .from('savings_goals')
          .update(values)
          .eq('id', existing.id)
          .select('id, target_amount, current_amount, currency, updated_at')
          .single()
        : await supabase
          .from('savings_goals')
          .insert(values)
          .select('id, target_amount, current_amount, currency, updated_at')
          .single();

      if (result.error || !result.data) {
        throw result.error ?? new Error('Your buffer goal could not be saved.');
      }

      return mapBufferGoal(result.data as BufferGoalRow);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['primary-buffer-goal', user?.id] });
    },
  });
}
