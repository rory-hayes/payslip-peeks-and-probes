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
      // Check subscriptions table — include canceled subs that still have time remaining
      const { data: subs, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('environment', env)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Find an active or still-valid subscription
      const now = new Date().toISOString();
      const activeSub = (subs ?? []).find(sub => {
        if (sub.status === 'active' || sub.status === 'trialing') return true;
        // Canceled but period hasn't ended yet — still has access
        if (sub.status === 'canceled' && sub.current_period_end && sub.current_period_end > now) return true;
        return false;
      });

      if (activeSub) {
        const isLifetime = activeSub.price_id === 'lifetime_once' || activeSub.price_id === 'lifetime_once_gbp' || activeSub.product_id === 'lifetime_plan';
        const isCanceled = activeSub.status === 'canceled' || activeSub.cancel_at_period_end;
        return {
          plan: isLifetime ? 'lifetime' : 'plus',
          status: activeSub.status,
          isPremium: true,
          cancelAtPeriodEnd: isCanceled ?? false,
          currentPeriodEnd: activeSub.current_period_end,
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
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    ...query,
    subscription: query.data ?? { plan: 'free' as Plan, status: 'active', isPremium: false },
    limits: FREE_LIMITS,
  };
}
