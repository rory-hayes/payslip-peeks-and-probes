export type CheckoutIntentEnvironment = "sandbox" | "live";
export type CheckoutIntentMode = "payment" | "subscription";

/**
 * The only durable bridge between an app checkout and a Stripe webhook. A
 * Stripe metadata field is useful context, but it is never enough on its own
 * to grant an entitlement.
 */
export interface CheckoutIntentBinding {
  id: string;
  user_id: string;
  environment: CheckoutIntentEnvironment;
  price_lookup_key: string;
  checkout_mode: CheckoutIntentMode;
  stripe_checkout_session_id: string | null;
}

export interface CheckoutIntentSessionClaim {
  checkoutIntentId: string | null;
  checkoutMode: CheckoutIntentMode;
  environment: CheckoutIntentEnvironment;
  priceLookupKey: string;
  sessionId: string;
  userId: string;
}

export interface LifetimeCheckoutIntentBinding extends CheckoutIntentBinding {
  stripe_payment_intent_id: string | null;
}

export interface LifetimeCheckoutPaymentClaim extends CheckoutIntentSessionClaim {
  paymentIntentId: string;
}

export interface StripeChargeRefundSnapshot {
  amount: number;
  amount_refunded: number;
  refunded: boolean;
}

/**
 * A webhook may only change billing state when its Stripe Checkout Session was
 * first reserved and bound by this app. In particular, do not treat a caller
 * supplied client reference or metadata user ID as an entitlement grant.
 */
export function matchesBoundCheckoutIntent(
  intent: CheckoutIntentBinding | null,
  claim: CheckoutIntentSessionClaim,
): boolean {
  return intent !== null
    && claim.checkoutIntentId !== null
    && intent.id === claim.checkoutIntentId
    && intent.user_id === claim.userId
    && intent.environment === claim.environment
    && intent.price_lookup_key === claim.priceLookupKey
    && intent.checkout_mode === claim.checkoutMode
    && intent.stripe_checkout_session_id === claim.sessionId;
}

/**
 * A payment-intent metadata value is only a lookup hint. The webhook must
 * still retrieve the exact, app-bound Checkout Session and prove that it owns
 * this PaymentIntent before this predicate is used to change entitlement.
 *
 * A null stored PaymentIntent is allowed solely for the legitimate ordering
 * case where a refund webhook wins the checkout-completion webhook. Once the
 * session proof succeeds, the server records the ID transactionally.
 */
export function matchesBoundLifetimeCheckoutPayment(
  intent: LifetimeCheckoutIntentBinding | null,
  claim: LifetimeCheckoutPaymentClaim,
): boolean {
  return matchesBoundCheckoutIntent(intent, claim)
    && intent?.checkout_mode === "payment"
    && (
      intent.stripe_payment_intent_id === null
      || intent.stripe_payment_intent_id === claim.paymentIntentId
    );
}

/**
 * `charge.refunded` can represent a partial refund. Entitlement is revoked
 * automatically only once Stripe reports that the whole captured charge has
 * been refunded; partial, pending, failed, and malformed refunds need a
 * separate commercial/manual decision.
 */
export function isFullyRefundedCharge(charge: StripeChargeRefundSnapshot): boolean {
  return Number.isSafeInteger(charge.amount)
    && Number.isSafeInteger(charge.amount_refunded)
    && charge.amount > 0
    && charge.amount_refunded === charge.amount
    && charge.refunded === true;
}
