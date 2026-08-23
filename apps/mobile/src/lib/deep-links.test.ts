import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-url-polyfill/auto', () => ({}));

import { parseAuthRedirect } from './deep-links';

describe('parseAuthRedirect', () => {
  it('accepts the documented email-confirmation callback', () => {
    expect(parseAuthRedirect('payslipinsights://auth/callback?code=confirmation-code&type=signup')).toEqual({
      code: 'confirmation-code',
      errorDescription: null,
      type: 'signup',
    });
  });

  it('accepts a PKCE password-reset callback with a one-time code', () => {
    expect(parseAuthRedirect('payslipinsights://reset-password#code=recovery-code&type=recovery')).toEqual({
      code: 'recovery-code',
      errorDescription: null,
      type: 'recovery',
    });
  });

  it('keeps provider error redirects on the documented callback route', () => {
    expect(parseAuthRedirect('payslipinsights://auth/callback?error_description=link-expired')).toEqual({
      code: null,
      errorDescription: 'link-expired',
      type: null,
    });
  });

  it('rejects bearer tokens on the custom scheme, including mixed code and token redirects', () => {
    expect(parseAuthRedirect('payslipinsights://reset-password#access_token=access-token&refresh_token=refresh-token&type=recovery')).toBeNull();
    expect(parseAuthRedirect('payslipinsights://reset-password?code=recovery-code&refresh_token=unexpected')).toBeNull();
  });

  it('rejects token-bearing URLs outside the two registered native callback routes', () => {
    expect(parseAuthRedirect('https://attacker.example/auth/callback?code=attacker-code')).toBeNull();
    expect(parseAuthRedirect('payslipinsights://attacker/callback?code=attacker-code')).toBeNull();
    expect(parseAuthRedirect('payslipinsights://auth/callback/extra?code=attacker-code')).toBeNull();
    expect(parseAuthRedirect('payslipinsights://reset-password/extra#access_token=attacker-token')).toBeNull();
  });
});
