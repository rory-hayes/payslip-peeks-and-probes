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
const BILLING_REVIEW_STATUSES = new Set(['past_due', 'unpaid', 'incomplete', 'paused']);

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

/**
 * A failed recurring payment is not an entitlement, but it is still a live
 * billing relationship. Surface it in Settings so a customer can reach the
 * verified billing path instead of being told to buy another plan.
 */
export function hasRecurringBillingIssue<T extends SubscriptionEntitlement>(subscriptions: T[]) {
  return subscriptions.some((subscription) => (
    !isLifetimeEntitlement(subscription)
    && BILLING_REVIEW_STATUSES.has(subscription.status)
  ));
}

const FREE_LIMITS = {
  uploads_per_month: 3,
  drafts_per_month: 2,
  comparison_months: 1,
};

export function useSubscription() {
  const { user } = useAuth();
  const env = getStripeEnvironment();
  const billingConfigured = !!env;

  const query = useQuery({
    queryKey: ['subscription', user?.id, env],
    queryFn: async (): Promise<Subscription> => {
      // Do not default unknown browser payment configuration to live. It could
      // otherwise query and display entitlements from the wrong environment.
      if (!env) return { plan: 'free', status: 'active', isPremium: false };

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
      const { data: legacy, error: legacyError } = await supabase
        .from('billing_subscriptions')
        .select('plan, status')
        .eq('user_id', user!.id)
        .maybeSingle();

      // A legacy record can change what billing action is safe to offer. Do
      // not silently treat an unreadable query as a Free account: callers use
      // the query error to stop checkout and ask the customer to retry.
      if (legacyError) throw legacyError;

      const needsBillingReview = hasRecurringBillingIssue(subs ?? []) || (
        legacy?.plan === 'plus'
        && (legacy.status === 'active' || legacy.status === 'past_due')
      );
      return { plan: 'free', status: 'active', isPremium: false, needsBillingReview };
    },
    enabled: !!user && !!env,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    ...query,
    // An unconfigured browser payment key must not query an arbitrary billing
    // environment, but it also must not lock a signed-in Free customer out of
    // their ordinary uploads and drafts. Treat only this deliberately disabled
    // billing lookup as settled Free access; the usage query remains separate.
    isSuccess: query.isSuccess || (!!user && !billingConfigured),
    subscription: query.data ?? { plan: 'free' as Plan, status: 'active', isPremium: false },
    limits: FREE_LIMITS,
  };
}
