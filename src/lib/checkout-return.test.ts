import { describe, expect, it } from 'vitest';
import { parseCheckoutReturnVerification } from '@/lib/checkout-return';

describe('parseCheckoutReturnVerification', () => {
  it('accepts only the narrow server-owned checkout status contract', () => {
    expect(parseCheckoutReturnVerification({ environment: 'sandbox', status: 'confirmed' })).toEqual({
      environment: 'sandbox',
      status: 'confirmed',
    });
    expect(parseCheckoutReturnVerification({ environment: 'live', status: 'review' })).toEqual({
      environment: 'live',
      status: 'review',
    });
  });

  it('fails closed for missing, malformed, or unknown values', () => {
    expect(parseCheckoutReturnVerification(null)).toBeNull();
    expect(parseCheckoutReturnVerification({ status: 'confirmed' })).toBeNull();
    expect(parseCheckoutReturnVerification({ environment: 'sandbox', status: 'success' })).toBeNull();
    expect(parseCheckoutReturnVerification({ environment: 'test', status: 'pending' })).toBeNull();
  });
});
