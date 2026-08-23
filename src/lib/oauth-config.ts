/**
 * Social sign-in is opt-in because it depends on a separately configured
 * provider, redirect allow-list, and branded consent screen. Showing a button
 * before those are live creates a dead-end at the most important conversion
 * step, so the default public surface is the verified email flow.
 */
export function isGoogleOAuthEnabled(value = import.meta.env.VITE_ENABLE_GOOGLE_OAUTH): boolean {
  return value?.trim().toLowerCase() === 'true';
}
