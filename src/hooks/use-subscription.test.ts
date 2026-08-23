import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findCurrentPremiumSubscription,
  hasRecurringBillingIssue,
  isCurrentPremiumSubscription,
  useSubscription,
} from '@/hooks/use-subscription';

const mocks = vi.hoisted(() => ({
  environment: null as 'sandbox' | 'live' | null,
  from: vi.fn(),
  user: { id: 'user-123' } as { id: string } | null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('@/lib/stripe', () => ({
  getStripeEnvironment: () => mocks.environment,
}));

const now = new Date('2026-08-02T12:00:00.000Z');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function subscription(overrides: Partial<{
  status: string;
  current_period_end: string | null;
  price_id: string;
  product_id: string;
  cancel_at_period_end: boolean | null;
}> = {}) {
  return {
    status: 'active',
    current_period_end: '2026-09-02T12:00:00.000Z',
    price_id: 'plus_monthly',
    product_id: 'prod_plus',
    cancel_at_period_end: false,
    ...overrides,
  };
}

describe('subscription entitlement selection', () => {
  beforeEach(() => {
    mocks.environment = null;
    mocks.from.mockReset();
    mocks.user = { id: 'user-123' };
  });

  it('does not retain recurring access after its stored period has ended', () => {
    expect(isCurrentPremiumSubscription(subscription({
      current_period_end: '2026-08-01T12:00:00.000Z',
    }), now)).toBe(false);
  });

  it('keeps an active recognised lifetime purchase without a period end', () => {
    expect(isCurrentPremiumSubscription(subscription({
      current_period_end: null,
      price_id: 'lifetime_once_gbp',
      product_id: 'lifetime',
    }), now)).toBe(true);
  });

  it('keeps a canceled recurring plan only until its paid period ends', () => {
    const current = subscription({ status: 'canceled', cancel_at_period_end: true });
    const expired = subscription({
      status: 'canceled',
      current_period_end: '2026-08-01T12:00:00.000Z',
      cancel_at_period_end: true,
    });

    expect(findCurrentPremiumSubscription([expired, current], now)).toBe(current);
  });

  it('fails closed for a recurring row with no confirmed period end', () => {
    expect(isCurrentPremiumSubscription(subscription({ current_period_end: null }), now)).toBe(false);
  });

  it('surfaces a failed recurring payment for billing management without granting premium access', () => {
    expect(hasRecurringBillingIssue([
      subscription({ status: 'past_due', current_period_end: null }),
      subscription({ status: 'incomplete', current_period_end: null }),
    ])).toBe(true);
    expect(hasRecurringBillingIssue([
      subscription({
        status: 'active',
        current_period_end: null,
        price_id: 'lifetime_once',
        product_id: 'lifetime',
      }),
    ])).toBe(false);
  });

  it('keeps the Free plan usable when browser checkout is deliberately unavailable', () => {
    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.subscription).toMatchObject({ plan: 'free', isPremium: false });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('does not turn a legacy billing lookup error into a Free billing state', async () => {
    mocks.environment = 'sandbox';
    const legacyError = new Error('legacy billing lookup unavailable');
    mocks.from.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        };
      }

      if (table === 'billing_subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: legacyError }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isSuccess).toBe(false);
    expect(mocks.from).toHaveBeenCalledWith('billing_subscriptions');
  });
});
