export type CheckoutReturnVerificationStatus = 'confirmed' | 'pending' | 'invalid' | 'review';
export type CheckoutReturnEnvironment = 'sandbox' | 'live';

export interface CheckoutReturnVerification {
  environment: CheckoutReturnEnvironment;
  status: CheckoutReturnVerificationStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The checkout-return endpoint deliberately exposes only a small, non-secret
 * state machine. The browser must reject malformed responses rather than
 * inferring payment success from a broad account-level subscription record.
 */
export function parseCheckoutReturnVerification(value: unknown): CheckoutReturnVerification | null {
  if (!isRecord(value)) return null;

  const status = value.status;
  const environment = value.environment;
  if (
    (status !== 'confirmed' && status !== 'pending' && status !== 'invalid' && status !== 'review')
    || (environment !== 'sandbox' && environment !== 'live')
  ) {
    return null;
  }

  return { environment, status };
}
