import { describe, expect, it } from 'vitest';
import {
  findCurrentPremiumSubscription,
  isCurrentPremiumSubscription,
} from '@/hooks/use-subscription';

const now = new Date('2026-08-02T12:00:00.000Z');

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
});
