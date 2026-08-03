import 'react-native-url-polyfill/auto';

/**
 * This must match `expo.scheme` in app.json. Supabase sends recovery links
 * back to installed builds through this public app scheme.
 */
export const PASSWORD_RESET_REDIRECT_URL = 'payslipinsights://reset-password';
export const EMAIL_CONFIRMATION_REDIRECT_URL = 'payslipinsights://auth/callback';

export type AuthRedirect = {
  accessToken: string | null;
  code: string | null;
  errorDescription: string | null;
  refreshToken: string | null;
  type: string | null;
};

/**
 * Native auth redirects can put values in either the query string or hash.
 * Keeping this parser local means the client never needs to log a sensitive
 * redirect URL or hand its token to a web view.
 */
export function parseAuthRedirect(url: string): AuthRedirect | null {
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');
  const query = queryStart >= 0
    ? url.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined)
    : '';
  const hash = hashStart >= 0 ? url.slice(hashStart + 1) : '';
  const params = new URLSearchParams([query, hash].filter(Boolean).join('&'));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const code = params.get('code');
  const errorDescription = params.get('error_description') ?? params.get('error');

  if (!accessToken && !code && !errorDescription) return null;

  return {
    accessToken,
    code,
    errorDescription,
    refreshToken,
    type: params.get('type'),
  };
}
