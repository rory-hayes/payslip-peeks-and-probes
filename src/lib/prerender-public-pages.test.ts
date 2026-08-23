import { describe, expect, it } from 'vitest';
import {
  STATIC_NOINDEX_PAGES,
  STATIC_SEO_PAGES,
  rewriteHead,
  rewriteNoIndexHead,
} from '../../vite-plugins/prerender-guides';

const BASE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Old title</title>
    <meta name="description" content="Old description">
    <link rel="canonical" href="https://payslipinsights.com/">
    <meta property="og:type" content="website">
    <meta property="og:title" content="Old title">
    <meta property="og:description" content="Old description">
    <meta property="og:url" content="https://payslipinsights.com/">
    <meta property="og:site_name" content="Payslip Insights">
    <meta property="og:image" content="https://payslipinsights.com/og-default.png">
    <meta property="og:image:width" content="1731">
    <meta property="og:image:height" content="909">
    <meta property="og:image:alt" content="Old image">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Old title">
    <meta name="twitter:description" content="Old description">
    <meta name="twitter:image" content="https://payslipinsights.com/og-default.png">
    <meta name="twitter:image:alt" content="Old image">
    <script type="application/ld+json" id="prerendered-article-schema">{"old":true}</script>
  </head>
  <body><div id="root"></div><script type="module" src="/assets/app.js"></script></body>
</html>`;

describe('static public-page prerendering', () => {
  it('only includes the intentional marketing and guide route whitelist', () => {
    const paths = STATIC_SEO_PAGES.map((page) => page.path);

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(expect.arrayContaining(['/', '/pricing', '/guides', '/guides/uk-payslip-guide']));
    expect(paths).not.toEqual(expect.arrayContaining(['/calculator', '/sign-in', '/checkout', '/dashboard']));
  });

  it('keeps the static noindex shell distinct from indexable public routes', () => {
    const indexablePaths = new Set(STATIC_SEO_PAGES.map((page) => page.path));
    const noIndexPaths = STATIC_NOINDEX_PAGES.map((page) => page.path);

    expect(new Set(noIndexPaths).size).toBe(noIndexPaths.length);
    expect(noIndexPaths).toEqual(expect.arrayContaining(['/calculator', '/sign-in', '/dashboard', '/checkout/return']));
    expect(noIndexPaths.some((path) => indexablePaths.has(path))).toBe(false);
  });

  it('writes a self-contained canonical, social card, and one schema payload for each public page', () => {
    for (const page of STATIC_SEO_PAGES) {
      const html = rewriteHead(BASE_HTML, page);
      const canonical = `https://payslipinsights.com${page.path}`;
      const parsed = new DOMParser().parseFromString(html, 'text/html');

      expect(parsed.title).toBe(page.title);
      expect(parsed.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical);
      expect(parsed.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(canonical);
      expect(parsed.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(page.ogType);
      expect(parsed.querySelector('meta[property="og:image"]')?.getAttribute('content'))
        .toBe('https://payslipinsights.com/og-default.png');
      expect(parsed.querySelector('meta[name="twitter:image"]')?.getAttribute('content'))
        .toBe('https://payslipinsights.com/og-default.png');
      expect(parsed.querySelectorAll('#prerendered-seo-schema')).toHaveLength(1);
      expect(parsed.getElementById('prerendered-article-schema')).toBeNull();
    }
  });

  it('uses article metadata only for guides', () => {
    const pricing = STATIC_SEO_PAGES.find((page) => page.path === '/pricing');
    const guide = STATIC_SEO_PAGES.find((page) => page.path === '/guides/how-to-check-your-payslip');

    expect(pricing?.ogType).toBe('website');
    expect(guide?.ogType).toBe('article');
  });

  it('removes canonical, sharing, and structured data from a static noindex route', () => {
    const signIn = STATIC_NOINDEX_PAGES.find((page) => page.path === '/sign-in');
    if (!signIn) throw new Error('Expected static sign-in shell.');

    const parsed = new DOMParser().parseFromString(rewriteNoIndexHead(BASE_HTML, signIn), 'text/html');

    expect(parsed.title).toBe('Sign in | Payslip Insights');
    expect(parsed.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    expect(parsed.querySelector('link[rel="canonical"]')).toBeNull();
    expect(parsed.querySelectorAll('meta[property^="og:"]')).toHaveLength(0);
    expect(parsed.querySelectorAll('meta[name^="twitter:"]')).toHaveLength(0);
    expect(parsed.getElementById('prerendered-seo-schema')).toBeNull();
    expect(parsed.getElementById('prerendered-article-schema')).toBeNull();
  });
});
