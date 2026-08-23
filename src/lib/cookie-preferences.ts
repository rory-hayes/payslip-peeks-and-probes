export const COOKIE_PREFERENCES_EVENT = 'paycheck:open-cookie-preferences';

/** Requests that the global consent control show the optional-analytics choice. */
export function openCookiePreferences() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT));
}
