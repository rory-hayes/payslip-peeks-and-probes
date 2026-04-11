import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Plan = 'free' | 'plus';

export interface Subscription {
  plan: Plan;
  status: string;
  isPremium: boolean;
}

const FREE_LIMITS = {
  uploads_per_month: 3,
  drafts_per_month: 2,
  comparison_months: 1,
};

export function useSubscription() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async (): Promise<Subscription> => {
      const { data, error } = await supabase
        .from('billing_subscriptions')
        .select('plan, status')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;

      const plan = (data?.plan === 'plus' ? 'plus' : 'free') as Plan;
      const status = data?.status ?? 'active';

      return {
        plan,
        status,
        isPremium: plan === 'plus' && status === 'active',
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    subscription: query.data ?? { plan: 'free' as Plan, status: 'active', isPremium: false },
    limits: FREE_LIMITS,
  };
}
