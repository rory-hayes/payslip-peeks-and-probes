import { afterEach, describe, expect, it } from 'vitest';
import { applySeo } from './seo';

const JSON_LD_ID = 'paycheck-jsonld';

function removeManagedHeadTags() {
  document.head.querySelector('meta[name="description"]')?.remove();
  document.head.querySelector('meta[property="og:title"]')?.remove();
  document.head.querySelector('meta[property="og:description"]')?.remove();
  document.head.querySelector('meta[property="og:type"]')?.remove();
  document.head.querySelector('meta[property="og:url"]')?.remove();
  document.head.querySelector('meta[property="og:image"]')?.remove();
  document.head.querySelector('meta[property="og:image:width"]')?.remove();
  document.head.querySelector('meta[property="og:image:height"]')?.remove();
  document.head.querySelector('meta[property="og:image:alt"]')?.remove();
  document.head.querySelector('meta[name="robots"]')?.remove();
  document.head.querySelector('meta[name="twitter:card"]')?.remove();
  document.head.querySelector('meta[name="twitter:title"]')?.remove();
  document.head.querySelector('meta[name="twitter:description"]')?.remove();
  document.head.querySelector('meta[name="twitter:image"]')?.remove();
  document.head.querySelector('meta[name="twitter:image:alt"]')?.remove();
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.getElementById(JSON_LD_ID)?.remove();
}

describe('applySeo', () => {
  afterEach(() => {
    removeManagedHeadTags();
  });

  it('keeps marketing metadata, canonical URLs, and structured data aligned', () => {
    applySeo({
      title: 'Pricing | Payslip Insights',
      description: 'Compare plans without sending private pay data to analytics.',
      canonicalPath: '/pricing',
      jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Pricing' },
    });

    expect(document.title).toBe('Pricing | Payslip Insights');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe('Compare plans without sending private pay data to analytics.');
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content'))
      .toBe('Pricing | Payslip Insights');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${window.location.origin}/pricing`);
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content'))
      .toBe(`${window.location.origin}/pricing`);
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content'))
      .toBe(`${window.location.origin}/og-default.png`);
    expect(document.head.querySelector('meta[name="twitter:image:alt"]')?.getAttribute('content'))
      .toMatch(/illustrated payslip/i);
    expect(document.getElementById(JSON_LD_ID)?.textContent).toContain('"name":"Pricing"');
  });

  it('removes stale structured data when a following page has none', () => {
    applySeo({
      title: 'Guides | Payslip Insights',
      description: 'Guides',
      jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage' },
    });
    applySeo({ title: 'Privacy Policy | Payslip Insights', description: 'Privacy' });

    expect(document.getElementById(JSON_LD_ID)).toBeNull();
  });

  it('removes canonical and sharing metadata on a noindex route, then restores public metadata', () => {
    applySeo({
      title: 'Sign in | Payslip Insights',
      description: 'Secure account access.',
      canonicalPath: null,
      noIndex: true,
    });

    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content'))
      .toBe('noindex, nofollow');

    applySeo({ title: 'Guides | Payslip Insights', description: 'Guides', canonicalPath: '/guides' });

    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe(`${window.location.origin}/guides`);
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
