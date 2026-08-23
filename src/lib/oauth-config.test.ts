import { describe, expect, it } from 'vitest';
import { isGoogleOAuthEnabled } from './oauth-config';

describe('Google OAuth launch gate', () => {
  it('is disabled unless the release explicitly opts in', () => {
    expect(isGoogleOAuthEnabled(undefined)).toBe(false);
    expect(isGoogleOAuthEnabled('false')).toBe(false);
    expect(isGoogleOAuthEnabled('anything else')).toBe(false);
  });

  it('accepts an explicit, case-insensitive true flag', () => {
    expect(isGoogleOAuthEnabled('true')).toBe(true);
    expect(isGoogleOAuthEnabled(' TRUE ')).toBe(true);
  });
});
