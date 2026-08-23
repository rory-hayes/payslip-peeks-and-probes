/**
 * Consent-aware analytics layer.
 *
 * Analytics providers are only initialised after the visitor has actively
 * accepted non-essential cookies. With no configured provider, every call is
 * a no-op. This keeps product features independent of analytics availability.
 *
 * The optional Plausible integration is deliberately narrower than the rest
 * of this interface: it records only public marketing routes and a small,
 * explicit list of static marketing events. It never forwards event
 * properties or user identifiers. That prevents payslip, account, and URL
 * identifiers from being sent to the analytics provider by accident.
 */

const CONSENT_KEY = 'paycheck.cookie_consent';
const CONSENT_EVENT = 'paycheck:cookie-consent-changed';
const PLAUSIBLE_SCRIPT_URL = 'https://plausible.io/js/script.manual.js';
const PLAUSIBLE_SCRIPT_ATTRIBUTE = 'data-payslip-insights-plausible';

export type ConsentValue = 'accepted' | 'declined' | null;

export interface AnalyticsProvider {
  /** Called once, after the visitor accepts cookies. Load scripts here. */
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

type PlausibleOptions = {
  url?: string;
};

type PlausibleFunction = (event: string, options?: PlausibleOptions) => void;

declare global {
  interface Window {
    plausible?: PlausibleFunction;
  }
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
let bootstrapped = false;
let consentEventHandler: EventListener | null = null;
let storageEventHandler: ((event: StorageEvent) => void) | null = null;
// Invalidates an in-flight provider initialisation when consent is withdrawn.
// A script response can arrive after its DOM node has been removed, so a
// simple `initialised` flag is not enough to protect the consent boundary.
let analyticsInitEpoch = 0;

// Buffer up to 50 calls fired before an opted-in provider has loaded.
const queue: Array<() => void> = [];
const MAX_QUEUE = 50;

function flushQueue() {
  while (queue.length > 0) {
    const fn = queue.shift();
    try {
      fn?.();
    } catch (err) {
      // Analytics must never break the product.
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
    const value = window.localStorage.getItem(CONSENT_KEY);
    if (value === 'accepted' || value === 'declined') return value;
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
    // Non-browser environment — ignore.
  }
}

// ---------- Privacy-safe Plausible provider ----------

/**
 * Plausible's dashboard site identifier is intentionally public. It is not a
 * credential, but it must be a bare hostname (for example,
 * `payslipinsights.com`) rather than a URL or an API key.
 */
export function getPlausibleDomain(rawValue = import.meta.env.VITE_PLAUSIBLE_DOMAIN): string | null {
  const domain = rawValue?.trim().toLowerCase();
  if (!domain || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain)) return null;
  return domain;
}

/**
 * Public routes that contain no customer-specific identifiers. Private routes
 * (including `/payslip/:id`, `/draft/:id`, and account recovery) are omitted
 * rather than redacted: they have no role in acquisition measurement.
 */
const MARKETING_PATHS: RegExp[] = [
  /^\/$/,
  /^\/(?:pricing|sign-in|sign-up)$/,
  /^\/guides(?:\/(?:how-to-check-your-payslip|why-did-my-net-pay-go-down|common-payslip-mistakes|compare-two-payslips|uk-payslip-guide|ireland-payslip-guide))?$/,
  /^\/calculator(?:\/(?:uk|ireland))?$/,
];

/**
 * Only static, product-level conversion events may be forwarded to Plausible.
 * Event properties are intentionally discarded, even for these events.
 */
const PLAUSIBLE_EVENT_ALLOWLIST = new Set([
  'marketing_cta_clicked',
  'demo_started',
  'pricing_cta_clicked',
  'sign_up_started',
]);

function getSafePlausibleUrl(path: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (!MARKETING_PATHS.some((pattern) => pattern.test(url.pathname))) return null;

    // Deliberately omit query strings and fragments. Authentication, payment,
    // and password recovery values must never be available to analytics.
    return `${window.location.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function createPlausibleProvider(domain: string): AnalyticsProvider {
  let script: HTMLScriptElement | null = null;
  let loadPromise: Promise<void> | null = null;
  let removeNavigationListener: (() => void) | null = null;
  let previousPlausible: PlausibleFunction | undefined;
  let loadEpoch = 0;
  let resolvePendingLoad: (() => void) | null = null;

  const sendPageView = (path: string) => {
    const url = getSafePlausibleUrl(path);
    if (!url || typeof window.plausible !== 'function') return;
    window.plausible('pageview', { url });
  };

  const trackCurrentPage = () => sendPageView(window.location.pathname);

  const observeNavigation = () => {
    if (removeNavigationListener) return;

    const history = window.history;
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);
    const onPopState = () => trackCurrentPage();

    history.pushState = ((...args: Parameters<History['pushState']>) => {
      originalPushState(...args);
      trackCurrentPage();
    }) as History['pushState'];

    history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      originalReplaceState(...args);
      trackCurrentPage();
    }) as History['replaceState'];

    window.addEventListener('popstate', onPopState);
    removeNavigationListener = () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', onPopState);
      removeNavigationListener = null;
    };
  };

  return {
    init: () => {
      if (loadPromise) return loadPromise;

      const attemptEpoch = loadEpoch;
      loadPromise = new Promise<void>((resolve, reject) => {
        previousPlausible = window.plausible;
        const scriptNode = document.createElement('script');
        script = scriptNode;
        resolvePendingLoad = resolve;
        scriptNode.async = true;
        scriptNode.src = PLAUSIBLE_SCRIPT_URL;
        scriptNode.dataset.domain = domain;
        scriptNode.setAttribute(PLAUSIBLE_SCRIPT_ATTRIBUTE, 'true');
        scriptNode.onload = () => {
          // A removed script can still fire a late load event in some browser
          // states. Never attach listeners or emit a page view after consent
          // has changed or a newer attempt has superseded this one.
          if (attemptEpoch !== loadEpoch || script !== scriptNode || !hasConsent()) {
            resolve();
            return;
          }
          resolvePendingLoad = null;
          // This is Plausible's documented manual-pageview mode. It lets us
          // send a fixed safe public URL rather than the browser's raw route.
          observeNavigation();
          trackCurrentPage();
          resolve();
        };
        scriptNode.onerror = () => {
          if (attemptEpoch !== loadEpoch || script !== scriptNode) {
            resolve();
            return;
          }
          resolvePendingLoad = null;
          loadPromise = null;
          reject(new Error('Plausible script failed to load'));
        };
        document.head.appendChild(scriptNode);
      });

      return loadPromise;
    },
    track: (event) => {
      if (!PLAUSIBLE_EVENT_ALLOWLIST.has(event) || typeof window.plausible !== 'function') return;
      // Never pass properties: callers might otherwise include an email,
      // payslip field, filename, token, plan value, or an internal ID.
      window.plausible(event);
    },
    page: sendPageView,
    // Intentionally no identify() implementation: Plausible must not receive
    // app user IDs or traits from this sensitive financial-document product.
    reset: () => {
      loadEpoch += 1;
      const pendingLoadResolver = resolvePendingLoad;
      resolvePendingLoad = null;
      removeNavigationListener?.();
      script?.remove();
      script = null;
      loadPromise = null;
      // Let the awaiting app-level initialiser unwind. Its epoch/consent
      // recheck below prevents this from turning into an active provider.
      pendingLoadResolver?.();

      if (previousPlausible === undefined) {
        delete window.plausible;
      } else {
        window.plausible = previousPlausible;
      }
      previousPlausible = undefined;
    },
  };
}

function configuredProvider(): AnalyticsProvider {
  const domain = getPlausibleDomain();
  return domain ? createPlausibleProvider(domain) : noopProvider;
}

function stopAnalytics() {
  analyticsInitEpoch += 1;
  provider.reset?.();
  initialised = false;
  queue.length = 0;
}

// ---------- Wire up: initialise on consent, tear down on withdrawal ----------

/**
 * Call once on app boot. Safe to call repeatedly. With
 * `VITE_PLAUSIBLE_DOMAIN` absent, the provider remains a no-op.
 */
export function initAnalytics(selectedProvider?: AnalyticsProvider) {
  if (selectedProvider) {
    provider = selectedProvider;
  } else if (provider === noopProvider) {
    provider = configuredProvider();
  }

  const tryInit = async () => {
    if (initialised || !hasConsent() || provider === noopProvider) return;

    const providerForAttempt = provider;
    const attemptEpoch = analyticsInitEpoch;
    try {
      await providerForAttempt.init();
      if (
        attemptEpoch !== analyticsInitEpoch
        || !hasConsent()
        || provider !== providerForAttempt
      ) return;
      initialised = true;
      flushQueue();
    } catch (err) {
      console.warn('[analytics] provider.init failed', err);
    }
  };

  // Run now if consent was already given by a returning visitor.
  void tryInit();

  if (bootstrapped) return;
  bootstrapped = true;

  consentEventHandler = ((event: CustomEvent<'accepted' | 'declined'>) => {
    if (event.detail === 'accepted') {
      void tryInit();
    } else if (event.detail === 'declined') {
      stopAnalytics();
    }
  }) as EventListener;
  window.addEventListener(CONSENT_EVENT, consentEventHandler);

  storageEventHandler = (event) => {
    if (event.key !== CONSENT_KEY) return;
    if (event.newValue === 'accepted') void tryInit();
    if (event.newValue === 'declined') stopAnalytics();
  };
  window.addEventListener('storage', storageEventHandler);
}

// ---------- Public API used by the rest of the app ----------

export const analytics = {
  track(event: string, properties?: Record<string, unknown>) {
    if (!hasConsent() || provider === noopProvider) return;
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
    if (!hasConsent() || provider === noopProvider) return;
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
    if (!hasConsent() || provider === noopProvider) return;
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

/** Test-only cleanup for isolated Vitest cases. */
export function __resetAnalyticsForTests() {
  stopAnalytics();
  provider = noopProvider;

  if (consentEventHandler) window.removeEventListener(CONSENT_EVENT, consentEventHandler);
  if (storageEventHandler) window.removeEventListener('storage', storageEventHandler);
  consentEventHandler = null;
  storageEventHandler = null;
  bootstrapped = false;
}
