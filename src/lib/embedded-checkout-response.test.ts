import { describe, expect, it } from 'vitest';
import { parseEmbeddedCheckoutResponse } from './embedded-checkout-response';

describe('parseEmbeddedCheckoutResponse', () => {
  it('accepts a complete, allowlisted checkout response', () => {
    expect(parseEmbeddedCheckoutResponse({
      clientSecret: 'cs_test_safe_embedded_secret',
      environment: 'sandbox',
      priceId: 'plus_yearly',
    })).toEqual({
      clientSecret: 'cs_test_safe_embedded_secret',
      environment: 'sandbox',
      priceId: 'plus_yearly',
    });
  });

  it('rejects incomplete, unsupported, or malformed responses', () => {
    expect(parseEmbeddedCheckoutResponse({ clientSecret: 'secret', priceId: 'plus_yearly' })).toBeNull();
    expect(parseEmbeddedCheckoutResponse({ clientSecret: 'secret', environment: 'test', priceId: 'plus_yearly' })).toBeNull();
    expect(parseEmbeddedCheckoutResponse({ clientSecret: 'secret', environment: 'live', priceId: 'custom' })).toBeNull();
    expect(parseEmbeddedCheckoutResponse(null)).toBeNull();
  });
});
