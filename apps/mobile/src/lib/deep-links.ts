import 'react-native-url-polyfill/auto';

/**
 * This must match `expo.scheme` in app.json. Supabase sends recovery links
 * back to installed builds through this public app scheme.
 */
export const PASSWORD_RESET_REDIRECT_URL = 'payslipinsights://reset-password';
export const EMAIL_CONFIRMATION_REDIRECT_URL = 'payslipinsights://auth/callback';

const AUTH_REDIRECT_ROUTES = [
  { host: 'auth', path: '/callback' },
  { host: 'reset-password', path: '' },
] as const;

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
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(url);
  } catch {
    return null;
  }

  // Linking emits every URL that opens the app. Only the two native URLs that
  // Supabase is configured to return to may supply a code or session tokens.
  const isExpectedCallback = callbackUrl.protocol === 'payslipinsights:'
    && AUTH_REDIRECT_ROUTES.some((route) => callbackUrl.host === route.host && callbackUrl.pathname === route.path);
  if (!isExpectedCallback) return null;

  const query = callbackUrl.search.slice(1);
  const hash = callbackUrl.hash.slice(1);
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
