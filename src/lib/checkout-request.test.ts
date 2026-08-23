import { describe, expect, it } from 'vitest';
import { validateCheckoutRequest } from '../../supabase/functions/_shared/checkout-request';

describe('server checkout request boundary', () => {
  it('accepts only an allowlisted plan in the exact server Stripe environment', () => {
    expect(validateCheckoutRequest({ environment: 'live', priceId: 'plus_yearly_gbp' }, 'live')).toMatchObject({
      ok: true,
      value: {
        catalogEntry: { currency: 'gbp', mode: 'subscription', unitAmount: 1799 },
        environment: 'live',
        priceId: 'plus_yearly_gbp',
      },
    });
  });

  it('fails closed when a stale browser bundle declares the other Stripe environment', () => {
    expect(validateCheckoutRequest({ environment: 'sandbox', priceId: 'plus_yearly' }, 'live')).toEqual({
      ok: false,
      response: {
        code: 'billing_environment_mismatch',
        error: 'Online checkout is temporarily unavailable while we verify its configuration. You have not been charged.',
      },
      status: 409,
    });
  });

  it('never treats an arbitrary plan key or omitted browser mode as a valid checkout request', () => {
    expect(validateCheckoutRequest({ environment: 'live', priceId: 'enterprise' }, 'live')).toEqual({
      ok: false,
      response: { error: 'That plan is not available.' },
      status: 400,
    });
    expect(validateCheckoutRequest({ priceId: 'plus_yearly' }, 'live')).toEqual({
      ok: false,
      response: {
        code: 'billing_environment_mismatch',
        error: 'Online checkout is temporarily unavailable while we verify its configuration. You have not been charged.',
      },
      status: 409,
    });
  });
});
