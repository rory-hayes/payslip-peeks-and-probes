import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-url-polyfill/auto', () => ({}));

import { parseAuthRedirect } from './deep-links';

describe('parseAuthRedirect', () => {
  it('accepts the documented email-confirmation callback', () => {
    expect(parseAuthRedirect('payslipinsights://auth/callback?code=confirmation-code&type=signup')).toEqual({
      accessToken: null,
      code: 'confirmation-code',
      errorDescription: null,
      refreshToken: null,
      type: 'signup',
    });
  });

  it('accepts the documented password-reset callback with hash tokens', () => {
    expect(parseAuthRedirect('payslipinsights://reset-password#access_token=access-token&refresh_token=refresh-token&type=recovery')).toEqual({
      accessToken: 'access-token',
      code: null,
      errorDescription: null,
      refreshToken: 'refresh-token',
      type: 'recovery',
    });
  });

  it('keeps provider error redirects on the documented callback route', () => {
    expect(parseAuthRedirect('payslipinsights://auth/callback?error_description=link-expired')).toEqual({
      accessToken: null,
      code: null,
      errorDescription: 'link-expired',
      refreshToken: null,
      type: null,
    });
  });

  it('rejects token-bearing URLs outside the two registered native callback routes', () => {
    expect(parseAuthRedirect('https://attacker.example/auth/callback?code=attacker-code')).toBeNull();
    expect(parseAuthRedirect('payslipinsights://attacker/callback?code=attacker-code')).toBeNull();
    expect(parseAuthRedirect('payslipinsights://auth/callback/extra?code=attacker-code')).toBeNull();
    expect(parseAuthRedirect('payslipinsights://reset-password/extra#access_token=attacker-token')).toBeNull();
  });
});
