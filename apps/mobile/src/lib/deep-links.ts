import 'react-native-url-polyfill/auto';

/**
 * These must match `expo.scheme` in app.json. The native client uses Supabase's
 * PKCE flow, so these redirects carry a one-time authorization code rather
 * than bearer session tokens.
 */
export const PASSWORD_RESET_REDIRECT_URL = 'payslipinsights://reset-password';
export const EMAIL_CONFIRMATION_REDIRECT_URL = 'payslipinsights://auth/callback';

const AUTH_REDIRECT_ROUTES = [
  { host: 'auth', path: '/callback' },
  { host: 'reset-password', path: '' },
] as const;

export type AuthRedirect = {
  code: string | null;
  errorDescription: string | null;
  type: string | null;
};

/**
 * Native auth redirects can put values in either the query string or hash.
 * Keeping this parser local means the client never needs to log a sensitive
 * redirect URL or hand its authorization code to a web view. Bearer tokens
 * are rejected: a custom URL scheme can be claimed by another app, while a
 * PKCE authorization code is useless without the verifier held by this app.
 */
export function parseAuthRedirect(url: string): AuthRedirect | null {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(url);
  } catch {
    return null;
  }

  // Linking emits every URL that opens the app. Only the two native URLs that
  // Supabase is configured to return to may supply a PKCE code or an error.
  const isExpectedCallback = callbackUrl.protocol === 'payslipinsights:'
    && AUTH_REDIRECT_ROUTES.some((route) => callbackUrl.host === route.host && callbackUrl.pathname === route.path);
  if (!isExpectedCallback) return null;

  const query = callbackUrl.search.slice(1);
  const hash = callbackUrl.hash.slice(1);
  const params = new URLSearchParams([query, hash].filter(Boolean).join('&'));
  const code = params.get('code');
  const errorDescription = params.get('error_description') ?? params.get('error');

  // Never accept an implicit-flow session from a custom scheme. Reject mixed
  // redirects too, so a future caller cannot accidentally prefer the code and
  // leave a bearer token exposed to a competing app.
  if (params.has('access_token') || params.has('refresh_token')) return null;
  if (!code && !errorDescription) return null;

  return {
    code,
    errorDescription,
    type: params.get('type'),
  };
}
