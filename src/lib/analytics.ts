/**
 * Consent-aware analytics layer.
 *
 * Analytics providers (Plausible, PostHog, GA, …) are only initialised AFTER
 * the user has actively clicked "Accept all" in the cookie banner. Until then
 * every track() call is a no-op, so we stay GDPR/PECR compliant out of the box.
 *
 * Usage:
 *   import { analytics } from '@/lib/analytics';
 *   analytics.track('payslip_uploaded', { country: 'UK' });
 *   analytics.page('/dashboard');
 *
 * Wiring a real provider later:
 *   1. Implement the AnalyticsProvider interface (see PlaceholderProvider).
 *   2. Replace `provider` in initAnalytics() with your provider instance.
 *   3. Call its setup/script-load logic inside provider.init().
 */

const CONSENT_KEY = 'paycheck.cookie_consent';
const CONSENT_EVENT = 'paycheck:cookie-consent-changed';

export type ConsentValue = 'accepted' | 'declined' | null;

export interface AnalyticsProvider {
  /** Called once, after the user accepts cookies. Load scripts here. */
  init: () => void | Promise<void>;
  /** Track a named event with optional properties. */
  track: (event: string, properties?: Record<string, unknown>) => void;
  /** Track a page view. */
  page: (path: string) => void;
  /** Identify the current user (after auth). */
  identify?: (userId: string, traits?: Record<string, unknown>) => void;
  /** Tear down on consent withdrawal. */
  reset?: () => void;
}

// ---------- No-op fallback (used until consent + provider are configured) ----------

const noopProvider: AnalyticsProvider = {
  init: () => {},
  track: () => {},
  page: () => {},
  identify: () => {},
  reset: () => {},
};

// ---------- Active provider slot ----------

let provider: AnalyticsProvider = noopProvider;
let initialised = false;
// Buffer up to 50 events fired before init completes (e.g. very early page loads).
const queue: Array<() => void> = [];
const MAX_QUEUE = 50;

function flushQueue() {
  while (queue.length > 0) {
    const fn = queue.shift();
    try {
      fn?.();
    } catch (err) {
      // Don't let analytics ever break the app.
      console.warn('[analytics] queued call failed', err);
    }
  }
}

function enqueue(fn: () => void) {
  if (queue.length < MAX_QUEUE) queue.push(fn);
}

// ---------- Consent helpers ----------

export function getConsent(): ConsentValue {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === 'accepted' || v === 'declined') return v;
  } catch {
    // localStorage unavailable
  }
  return null;
}

export function hasConsent(): boolean {
  return getConsent() === 'accepted';
}

/** Broadcast a consent change so the analytics layer can react in real time. */
export function broadcastConsentChange(value: 'accepted' | 'declined') {
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
  } catch {
    // SSR or non-browser env — ignore.
  }
}

// ---------- Wire up: initialise on consent, tear down on withdrawal ----------

/**
 * Call once on app boot. Safe to call multiple times.
 * Replace `selectedProvider` with a real provider when one is added.
 */
export function initAnalytics(selectedProvider?: AnalyticsProvider) {
  if (selectedProvider) provider = selectedProvider;

  const tryInit = async () => {
    if (initialised) return;
    if (!hasConsent()) return;
    if (provider === noopProvider) return; // nothing real to load yet
    try {
      await provider.init();
      initialised = true;
      flushQueue();
    } catch (err) {
      console.warn('[analytics] provider.init failed', err);
    }
  };

  // Run now if consent already given (returning visitor).
  void tryInit();

  // React to consent changes within this tab.
  window.addEventListener(CONSENT_EVENT, ((e: CustomEvent<'accepted' | 'declined'>) => {
    if (e.detail === 'accepted') {
      void tryInit();
    } else if (e.detail === 'declined' && initialised) {
      provider.reset?.();
      initialised = false;
    }
  }) as EventListener);

  // React to consent changes from another tab.
  window.addEventListener('storage', (e) => {
    if (e.key !== CONSENT_KEY) return;
    if (e.newValue === 'accepted') void tryInit();
    if (e.newValue === 'declined' && initialised) {
      provider.reset?.();
      initialised = false;
    }
  });
}

// ---------- Public API used by the rest of the app ----------

export const analytics = {
  track(event: string, properties?: Record<string, unknown>) {
    if (!hasConsent()) return; // hard gate
    if (!initialised) {
      enqueue(() => provider.track(event, properties));
      return;
    }
    try {
      provider.track(event, properties);
    } catch (err) {
      console.warn('[analytics] track failed', err);
    }
  },

  page(path: string) {
    if (!hasConsent()) return;
    if (!initialised) {
      enqueue(() => provider.page(path));
      return;
    }
    try {
      provider.page(path);
    } catch (err) {
      console.warn('[analytics] page failed', err);
    }
  },

  identify(userId: string, traits?: Record<string, unknown>) {
    if (!hasConsent()) return;
    if (!initialised) {
      enqueue(() => provider.identify?.(userId, traits));
      return;
    }
    try {
      provider.identify?.(userId, traits);
    } catch (err) {
      console.warn('[analytics] identify failed', err);
    }
  },
};

// ---------- Example provider stubs (uncomment & wire when ready) ----------

/**
 * Plausible (cookie-less, but still gated on consent because PECR treats
 * any 1st-party analytics as opt-in for some legal interpretations).
 */
// export const plausibleProvider: AnalyticsProvider = {
//   init: () => {
//     return new Promise<void>((resolve) => {
//       const s = document.createElement('script');
//       s.defer = true;
//       s.dataset.domain = 'paycheckinsights.com';
//       s.src = 'https://plausible.io/js/script.js';
//       s.onload = () => resolve();
//       document.head.appendChild(s);
//     });
//   },
//   track: (event, props) => (window as any).plausible?.(event, { props }),
//   page: () => (window as any).plausible?.('pageview'),
// };

/** PostHog (uses cookies — must be consent-gated). */
// export const posthogProvider: AnalyticsProvider = {
//   init: async () => {
//     const { default: posthog } = await import('posthog-js');
//     posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
//       api_host: 'https://eu.i.posthog.com',
//       persistence: 'localStorage',
//       disable_session_recording: true,
//     });
//     (window as any).__posthog = posthog;
//   },
//   track: (event, props) => (window as any).__posthog?.capture(event, props),
//   page: (path) => (window as any).__posthog?.capture('$pageview', { $current_url: path }),
//   identify: (id, traits) => (window as any).__posthog?.identify(id, traits),
//   reset: () => (window as any).__posthog?.reset(),
// };
