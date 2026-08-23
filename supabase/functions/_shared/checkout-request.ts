import {
  getPriceCatalogEntry,
  type PriceCatalogEntry,
  type PriceLookupKey,
} from './billing-catalog.ts';

export type CheckoutRequestEnvironment = 'sandbox' | 'live';

export type ValidatedCheckoutRequest = {
  catalogEntry: PriceCatalogEntry;
  environment: CheckoutRequestEnvironment;
  priceId: PriceLookupKey;
};

export type CheckoutRequestValidation =
  | { ok: true; value: ValidatedCheckoutRequest }
  | {
    ok: false;
    response: { code?: 'billing_environment_mismatch'; error: string };
    status: 400 | 409;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The browser may request a named plan and declare its public Stripe mode.
 * The server is still the source of truth for both the price catalogue and
 * active mode. This parser intentionally rejects the whole request rather
 * than silently defaulting either value.
 */
export function validateCheckoutRequest(
  body: unknown,
  environment: CheckoutRequestEnvironment,
): CheckoutRequestValidation {
  const priceId = isRecord(body) ? body.priceId : undefined;
  const catalogEntry = getPriceCatalogEntry(priceId);
  if (!catalogEntry || typeof priceId !== 'string') {
    return {
      ok: false,
      response: { error: 'That plan is not available.' },
      status: 400,
    };
  }

  const declaredBrowserEnvironment = isRecord(body) ? body.environment : null;
  if (declaredBrowserEnvironment !== environment) {
    return {
      ok: false,
      response: {
        code: 'billing_environment_mismatch',
        error: 'Online checkout is temporarily unavailable while we verify its configuration. You have not been charged.',
      },
      status: 409,
    };
  }

  return {
    ok: true,
    value: {
      catalogEntry,
      environment,
      priceId: priceId as PriceLookupKey,
    },
  };
}
