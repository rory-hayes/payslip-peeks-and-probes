import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetAnalyticsForTests,
  analytics,
  broadcastConsentChange,
  getPlausibleDomain,
  initAnalytics,
} from './analytics';

const CONSENT_KEY = 'paycheck.cookie_consent';
const SCRIPT_SELECTOR = 'script[data-payslip-insights-plausible="true"]';
const storage = new Map<string, string>();

function installLocalStorage() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => [...storage.keys()][index] ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      get length() {
        return storage.size;
      },
    } satisfies Storage,
  });
}

function acceptAnalyticsCookies() {
  window.localStorage.setItem(CONSENT_KEY, 'accepted');
}

function configuredScript(): HTMLScriptElement {
  const script = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
  if (!script) throw new Error('Expected Plausible script to be loaded');
  return script;
}

describe('consent-gated Plausible analytics', () => {
  beforeEach(() => {
    installLocalStorage();
    __resetAnalyticsForTests();
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'payslipinsights.com');
    window.localStorage.clear();
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((script) => script.remove());
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    __resetAnalyticsForTests();
    vi.unstubAllEnvs();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('keeps a configured provider dormant until the visitor opts in', () => {
    initAnalytics();

    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();

    acceptAnalyticsCookies();
    broadcastConsentChange('accepted');

    expect(configuredScript().src).toBe('https://plausible.io/js/script.manual.js');
  });

  it('preserves no-op behavior when no Plausible domain is configured', () => {
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', '');
    acceptAnalyticsCookies();

    initAnalytics();

    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
  });

  it('loads the manual tracker after consent and emits only a safe public route', async () => {
    acceptAnalyticsCookies();
    initAnalytics();

    const plausible = vi.fn();
    window.plausible = plausible;
    const script = configuredScript();

    expect(script.dataset.domain).toBe('payslipinsights.com');

    script.dispatchEvent(new Event('load'));
    await Promise.resolve();

    expect(plausible).toHaveBeenCalledWith('pageview', { url: `${window.location.origin}/` });
  });

  it('does not send a late page view when consent is withdrawn during script loading', async () => {
    acceptAnalyticsCookies();
    initAnalytics();

    const plausible = vi.fn();
    window.plausible = plausible;
    const script = configuredScript();

    window.localStorage.setItem(CONSENT_KEY, 'declined');
    broadcastConsentChange('declined');
    script.dispatchEvent(new Event('load'));
    await Promise.resolve();

    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
    expect(plausible).not.toHaveBeenCalled();
  });

  it('drops identifier-bearing routes, all event properties, and identify calls', async () => {
    acceptAnalyticsCookies();
    initAnalytics();

    const plausible = vi.fn();
    window.plausible = plausible;
    configuredScript().dispatchEvent(new Event('load'));
    await Promise.resolve();
    plausible.mockClear();

    analytics.page('/pricing?email=alex@example.com#access_token=never-send-this');
    analytics.page('/payslip/ps_123?token=never-send-this');
    analytics.track('sign_up_started', { email: 'alex@example.com', fileName: 'August payslip.pdf' });
    analytics.track('demo_started', { email: 'alex@example.com' });
    analytics.track('payslip_uploaded', { extractionText: 'private payroll data' });
    analytics.identify('user-123', { email: 'alex@example.com' });

    expect(plausible).toHaveBeenCalledTimes(3);
    expect(plausible).toHaveBeenNthCalledWith(1, 'pageview', { url: `${window.location.origin}/pricing` });
    expect(plausible).toHaveBeenNthCalledWith(2, 'sign_up_started');
    expect(plausible).toHaveBeenNthCalledWith(3, 'demo_started');
  });

  it('tracks pushState public navigation but never private payslip paths', async () => {
    acceptAnalyticsCookies();
    initAnalytics();

    const plausible = vi.fn();
    window.plausible = plausible;
    configuredScript().dispatchEvent(new Event('load'));
    await Promise.resolve();
    plausible.mockClear();

    window.history.pushState({}, '', '/guides/uk-payslip-guide?campaign=summer');
    window.history.pushState({}, '', '/draft/draft_456');

    expect(plausible).toHaveBeenCalledTimes(1);
    expect(plausible).toHaveBeenCalledWith('pageview', {
      url: `${window.location.origin}/guides/uk-payslip-guide`,
    });
  });

  it('accepts only bare domain configuration values', () => {
    expect(getPlausibleDomain('payslipinsights.com')).toBe('payslipinsights.com');
    expect(getPlausibleDomain('https://payslipinsights.com')).toBeNull();
    expect(getPlausibleDomain('')).toBeNull();
  });
});
