/**
 * A checkout selection is kept in the URL only to avoid losing a deliberate
 * plan choice while a person creates an account. It is not an entitlement:
 * the checkout edge function independently validates every requested key.
 */
export const CHECKOUT_PRICE_IDS = [
  'plus_yearly',
  'plus_monthly',
  'plus_yearly_gbp',
  'plus_monthly_gbp',
  'lifetime_once',
  'lifetime_once_gbp',
] as const;

export type CheckoutPriceId = typeof CHECKOUT_PRICE_IDS[number];

// Checkout return URLs carry an opaque Stripe Checkout Session id. Keep the
// continuation intentionally narrow: it must be a real Stripe test/live id,
// never an arbitrary path or redirect supplied in a query string.
const STRIPE_CHECKOUT_SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]+$/;

export function getCheckoutPriceId(value: unknown): CheckoutPriceId | null {
  if (typeof value !== 'string') return null;

  return (CHECKOUT_PRICE_IDS as readonly string[]).includes(value)
    ? value as CheckoutPriceId
    : null;
}

export function getCheckoutReturnSessionId(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  return STRIPE_CHECKOUT_SESSION_ID.test(value) ? value : null;
}

export function checkoutPathForPrice(priceId: CheckoutPriceId): string {
  return `/checkout?price=${priceId}`;
}

export function checkoutReturnPathForSession(sessionId: string): string {
  const checkoutReturnSessionId = getCheckoutReturnSessionId(sessionId);
  return checkoutReturnSessionId
    ? `/checkout/return?session_id=${encodeURIComponent(checkoutReturnSessionId)}`
    : '/checkout/return';
}

export function onboardingPathForCheckout(priceId: CheckoutPriceId | null): string {
  return priceId ? `/onboarding?checkout=${priceId}` : '/onboarding';
}

export function onboardingPathForCheckoutReturn(sessionId: string | null): string {
  const checkoutReturnSessionId = getCheckoutReturnSessionId(sessionId);
  return checkoutReturnSessionId
    ? `/onboarding?checkout_return=${encodeURIComponent(checkoutReturnSessionId)}`
    : '/onboarding';
}

export function signInPathForCheckout(priceId: CheckoutPriceId | null): string {
  return priceId ? `/sign-in?checkout=${priceId}` : '/sign-in';
}

export function signInPathForCheckoutReturn(sessionId: string | null): string {
  const checkoutReturnSessionId = getCheckoutReturnSessionId(sessionId);
  return checkoutReturnSessionId
    ? `/sign-in?checkout_return=${encodeURIComponent(checkoutReturnSessionId)}`
    : '/sign-in';
}

export function signUpPathForCheckout(priceId: CheckoutPriceId): string {
  return `/sign-up?checkout=${priceId}`;
}
