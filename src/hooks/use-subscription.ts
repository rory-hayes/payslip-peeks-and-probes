import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getStripeEnvironment } from '@/lib/stripe';

export type Plan = 'free' | 'plus' | 'lifetime';

export interface Subscription {
  plan: Plan;
  status: string;
  isPremium: boolean;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
}

const FREE_LIMITS = {
  uploads_per_month: 3,
  drafts_per_month: 2,
  comparison_months: 1,
};

export function useSubscription() {
  const { user } = useAuth();
  const env = getStripeEnvironment();

  const query = useQuery({
    queryKey: ['subscription', user?.id, env],
    queryFn: async (): Promise<Subscription> => {
      // Check new subscriptions table first
      const { data: sub, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('environment', env)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (sub) {
        const isLifetime = sub.price_id === 'lifetime_once' || sub.product_id === 'lifetime_plan';
        return {
          plan: isLifetime ? 'lifetime' : 'plus',
          status: sub.status,
          isPremium: true,
          cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
          currentPeriodEnd: sub.current_period_end,
        };
      }

      // Fallback: check legacy billing_subscriptions table
      const { data: legacy } = await supabase
        .from('billing_subscriptions')
        .select('plan, status')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (legacy?.plan === 'plus' && legacy?.status === 'active') {
        return { plan: 'plus', status: 'active', isPremium: true };
      }

      return { plan: 'free', status: 'active', isPremium: false };
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  return {
    ...query,
    subscription: query.data ?? { plan: 'free' as Plan, status: 'active', isPremium: false },
    limits: FREE_LIMITS,
  };
}
