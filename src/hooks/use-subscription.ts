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
  needsBillingReview?: boolean;
}

type SubscriptionEntitlement = {
  status: string;
  current_period_end: string | null;
  price_id: string;
  product_id: string;
  cancel_at_period_end: boolean | null;
};

const LIFETIME_PRICE_IDS = new Set(['lifetime_once', 'lifetime_once_gbp']);
const LIFETIME_PRODUCT_IDS = new Set(['lifetime', 'lifetime_plan']);
const CURRENT_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'canceled']);

export function isLifetimeEntitlement(subscription: Pick<SubscriptionEntitlement, 'price_id' | 'product_id'>) {
  return LIFETIME_PRICE_IDS.has(subscription.price_id)
    || LIFETIME_PRODUCT_IDS.has(subscription.product_id);
}

/**
 * A recurring entitlement must have a valid, future period end. This is
 * intentionally stricter than a stored `active` status so a delayed webhook
 * cannot leave access open after the paid period. Lifetime purchases have no
 * period end and are represented by a recognised product or price instead.
 */
export function isCurrentPremiumSubscription(
  subscription: SubscriptionEntitlement,
  now = new Date(),
) {
  if (isLifetimeEntitlement(subscription)) return subscription.status === 'active';
  if (!CURRENT_SUBSCRIPTION_STATUSES.has(subscription.status) || !subscription.current_period_end) {
    return false;
  }

  const periodEnd = Date.parse(subscription.current_period_end);
  return Number.isFinite(periodEnd) && periodEnd > now.getTime();
}

export function findCurrentPremiumSubscription<T extends SubscriptionEntitlement>(
  subscriptions: T[],
  now = new Date(),
): T | undefined {
  return subscriptions.find((subscription) => isCurrentPremiumSubscription(subscription, now));
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

      const activeSub = findCurrentPremiumSubscription(subs ?? []);

      if (activeSub) {
        const isLifetime = isLifetimeEntitlement(activeSub);
        const isCanceled = activeSub.status === 'canceled' || activeSub.cancel_at_period_end;
        return {
          plan: isLifetime ? 'lifetime' : 'plus',
          status: activeSub.status,
          isPremium: true,
          cancelAtPeriodEnd: isCanceled ?? false,
          currentPeriodEnd: activeSub.current_period_end,
        };
      }

      // A historical billing record is never a browser-side entitlement. Keep
      // it visible only so its owner can reach the remotely verified Stripe
      // portal while it is reconciled into the canonical subscriptions table.
      const { data: legacy } = await supabase
        .from('billing_subscriptions')
        .select('plan, status')
        .eq('user_id', user!.id)
        .maybeSingle();

      const needsBillingReview = legacy?.plan === 'plus'
        && (legacy.status === 'active' || legacy.status === 'past_due');
      return { plan: 'free', status: 'active', isPremium: false, needsBillingReview };
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
