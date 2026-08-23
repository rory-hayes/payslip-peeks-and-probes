import { describe, expect, it } from 'vitest';
import {
  checkoutPathForPrice,
  checkoutReturnPathForSession,
  getCheckoutPriceId,
  getCheckoutReturnSessionId,
  onboardingPathForCheckout,
  onboardingPathForCheckoutReturn,
  signInPathForCheckout,
  signInPathForCheckoutReturn,
  signUpPathForCheckout,
} from '@/lib/checkout-price';

describe('checkout price selection', () => {
  it('accepts only the client catalogue keys', () => {
    expect(getCheckoutPriceId('plus_yearly')).toBe('plus_yearly');
    expect(getCheckoutPriceId('lifetime_once_gbp')).toBe('lifetime_once_gbp');
    expect(getCheckoutPriceId('free')).toBeNull();
    expect(getCheckoutPriceId('plus_yearly&return=https://example.com')).toBeNull();
    expect(getCheckoutPriceId(null)).toBeNull();
  });

  it('keeps only a Stripe-shaped checkout return session through sign-in', () => {
    expect(getCheckoutReturnSessionId('cs_test_checkoutreturn123')).toBe('cs_test_checkoutreturn123');
    expect(getCheckoutReturnSessionId('cs_live_checkoutreturn456')).toBe('cs_live_checkoutreturn456');
    expect(getCheckoutReturnSessionId('cs_test_checkoutreturn123&next=/dashboard')).toBeNull();
    expect(getCheckoutReturnSessionId('https://example.com')).toBeNull();

    expect(signInPathForCheckoutReturn('cs_test_checkoutreturn123'))
      .toBe('/sign-in?checkout_return=cs_test_checkoutreturn123');
    expect(checkoutReturnPathForSession('cs_test_checkoutreturn123'))
      .toBe('/checkout/return?session_id=cs_test_checkoutreturn123');
    expect(onboardingPathForCheckoutReturn('cs_test_checkoutreturn123'))
      .toBe('/onboarding?checkout_return=cs_test_checkoutreturn123');
    expect(signInPathForCheckoutReturn('not-a-checkout-session')).toBe('/sign-in');
    expect(checkoutReturnPathForSession('not-a-checkout-session')).toBe('/checkout/return');
    expect(onboardingPathForCheckoutReturn('not-a-checkout-session')).toBe('/onboarding');
  });

  it('builds fixed local paths from an allowlisted price', () => {
    expect(signUpPathForCheckout('plus_yearly')).toBe('/sign-up?checkout=plus_yearly');
    expect(signInPathForCheckout('plus_yearly')).toBe('/sign-in?checkout=plus_yearly');
    expect(onboardingPathForCheckout('plus_yearly')).toBe('/onboarding?checkout=plus_yearly');
    expect(onboardingPathForCheckout(null)).toBe('/onboarding');
    expect(checkoutPathForPrice('plus_yearly')).toBe('/checkout?price=plus_yearly');
  });
});
