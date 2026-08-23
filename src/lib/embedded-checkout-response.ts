import { getCheckoutPriceId, type CheckoutPriceId } from './checkout-price';

export type CheckoutEnvironment = 'sandbox' | 'live';

export interface EmbeddedCheckoutResponse {
  clientSecret: string;
  environment: CheckoutEnvironment;
  priceId: CheckoutPriceId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A checkout client secret is only usable with the Stripe publishable key for
 * the same environment. Parse the minimal response contract before handing a
 * secret to Stripe's browser SDK.
 */
export function parseEmbeddedCheckoutResponse(value: unknown): EmbeddedCheckoutResponse | null {
  if (!isRecord(value)) return null;

  const priceId = getCheckoutPriceId(value.priceId);
  if (
    typeof value.clientSecret !== 'string'
    || value.clientSecret.length === 0
    || !priceId
    || (value.environment !== 'sandbox' && value.environment !== 'live')
  ) {
    return null;
  }

  return {
    clientSecret: value.clientSecret,
    environment: value.environment,
    priceId,
  };
}
