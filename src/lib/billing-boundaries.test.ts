import { describe, expect, it } from "vitest";
import {
  isFullyRefundedCharge,
  matchesBoundLifetimeCheckoutPayment,
  matchesBoundCheckoutIntent,
  type CheckoutIntentBinding,
  type LifetimeCheckoutIntentBinding,
} from "../../supabase/functions/_shared/checkout-intent";
import {
  matchesCatalogStripePrice,
  priceLookupKeyForCurrency,
} from "../../supabase/functions/_shared/billing-catalog";

const intent: CheckoutIntentBinding = {
  checkout_mode: "subscription",
  environment: "live",
  id: "1d2e3f4a-1111-4222-8333-444455556666",
  price_lookup_key: "plus_yearly",
  stripe_checkout_session_id: "cs_live_app_created",
  user_id: "1d2e3f4a-1111-4222-8333-444455556666",
};

const matchingClaim = {
  checkoutIntentId: intent.id,
  checkoutMode: "subscription" as const,
  environment: "live" as const,
  priceLookupKey: "plus_yearly",
  sessionId: "cs_live_app_created",
  userId: intent.user_id,
};

describe("billing trust boundaries", () => {
  it("only accepts a Stripe session that was bound to the exact app checkout intent", () => {
    expect(matchesBoundCheckoutIntent(intent, matchingClaim)).toBe(true);
    expect(matchesBoundCheckoutIntent(intent, { ...matchingClaim, sessionId: "cs_external" })).toBe(false);
    expect(matchesBoundCheckoutIntent(intent, { ...matchingClaim, checkoutIntentId: null })).toBe(false);
    expect(matchesBoundCheckoutIntent(null, matchingClaim)).toBe(false);
  });

  it("requires the original app-bound payment intent before a lifetime refund can act", () => {
    const lifetimeIntent: LifetimeCheckoutIntentBinding = {
      ...intent,
      checkout_mode: "payment",
      price_lookup_key: "lifetime_once",
      stripe_payment_intent_id: "pi_app_created",
    };
    const claim = {
      ...matchingClaim,
      checkoutMode: "payment" as const,
      priceLookupKey: "lifetime_once",
      paymentIntentId: "pi_app_created",
    };

    expect(matchesBoundLifetimeCheckoutPayment(lifetimeIntent, claim)).toBe(true);
    expect(matchesBoundLifetimeCheckoutPayment(lifetimeIntent, {
      ...claim,
      paymentIntentId: "pi_external",
    })).toBe(false);
    expect(matchesBoundLifetimeCheckoutPayment({
      ...lifetimeIntent,
      stripe_payment_intent_id: null,
    }, claim)).toBe(true);
  });

  it("revokes automatically only after Stripe reports the whole charge refunded", () => {
    expect(isFullyRefundedCharge({ amount: 3499, amount_refunded: 3499, refunded: true })).toBe(true);
    expect(isFullyRefundedCharge({ amount: 3499, amount_refunded: 1200, refunded: false })).toBe(false);
    expect(isFullyRefundedCharge({ amount: 3499, amount_refunded: 3499, refunded: false })).toBe(false);
    expect(isFullyRefundedCharge({ amount: 0, amount_refunded: 0, refunded: true })).toBe(false);
  });

  it("rejects a Stripe price whose commercial terms drift from the advertised catalog", () => {
    const matchingPrice = {
      active: true,
      currency: "eur",
      lookup_key: "plus_yearly",
      recurring: { interval: "year", interval_count: 1 },
      type: "subscription",
      unit_amount: 1999,
    };

    expect(matchesCatalogStripePrice(matchingPrice, "plus_yearly")).toBe(true);
    expect(matchesCatalogStripePrice({ ...matchingPrice, unit_amount: 2999 }, "plus_yearly")).toBe(false);
    expect(matchesCatalogStripePrice({ ...matchingPrice, currency: "gbp" }, "plus_yearly")).toBe(false);
    expect(matchesCatalogStripePrice({ ...matchingPrice, recurring: { interval: "month", interval_count: 1 } }, "plus_yearly")).toBe(false);
  });

  it("keeps the product and interval while enforcing the account billing currency", () => {
    expect(priceLookupKeyForCurrency("plus_yearly", "gbp")).toBe("plus_yearly_gbp");
    expect(priceLookupKeyForCurrency("plus_monthly_gbp", "eur")).toBe("plus_monthly");
    expect(priceLookupKeyForCurrency("lifetime_once", "gbp")).toBe("lifetime_once_gbp");
  });
});
