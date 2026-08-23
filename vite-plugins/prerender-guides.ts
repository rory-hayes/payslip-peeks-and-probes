import type { Plugin } from 'vite';
import {
  DEFAULT_OG_IMAGE,
  GUIDES_SEO,
  SITE_ORIGIN,
  TITLE_SUFFIX,
  buildArticleJsonLd,
} from '../src/lib/guide-seo-data';
import {
  INDEXABLE_MARKETING_PAGES,
  buildMarketingJsonLd,
} from '../src/lib/marketing-seo-data';

const DEFAULT_OG_IMAGE_ALT = 'An illustrated payslip being checked with a clear trend card';
const DEFAULT_OG_IMAGE_WIDTH = '1731';
const DEFAULT_OG_IMAGE_HEIGHT = '909';
const PRERENDERED_SCHEMA_ID = 'prerendered-seo-schema';
const PRERENDERED_SCHEMA_PATTERN = /<script[^>]+id=["']prerendered-(?:article|page|seo)-schema["'][^>]*>[\s\S]*?<\/script>/gi;

export interface StaticSeoPage {
  path: string;
  title: string;
  description: string;
  jsonLd: Record<string, unknown>;
  ogType: 'article' | 'website';
}

export interface StaticNoIndexPage {
  path: string;
  title: string;
  description: string;
}

/**
 * The only public routes that receive their own static HTML metadata. Account,
 * recovery, checkout, calculator-holding, and protected routes deliberately
 * remain outside this list.
 */
export const STATIC_SEO_PAGES: readonly StaticSeoPage[] = [
  ...INDEXABLE_MARKETING_PAGES.map((page) => ({
    path: page.path,
    title: page.title,
    description: page.description,
    jsonLd: buildMarketingJsonLd(page),
    ogType: 'website' as const,
  })),
  ...GUIDES_SEO.map((guide) => ({
    path: guide.path,
    title: `${guide.title}${TITLE_SUFFIX}`,
    description: guide.description,
    jsonLd: buildArticleJsonLd(guide),
    ogType: 'article' as const,
  })),
];

/**
 * Literal routes that should never inherit the public landing-page canonical
 * in the raw HTML response. Dynamic document and draft routes are protected by
 * authentication and robots rules, while these common entry points get their
 * own static noindex shell before React takes over.
 */
export const STATIC_NOINDEX_PAGES: readonly StaticNoIndexPage[] = [
  { path: '/calculator', title: 'Take-home pay calculator update | Payslip Insights', description: 'We are verifying current UK and Ireland payroll rules before publishing new take-home estimates.' },
  { path: '/sign-in', title: 'Sign in | Payslip Insights', description: 'Securely sign in to Payslip Insights.' },
  { path: '/sign-up', title: 'Create an account | Payslip Insights', description: 'Create a secure Payslip Insights account.' },
  { path: '/forgot-password', title: 'Reset your password | Payslip Insights', description: 'Request a secure Payslip Insights password reset link.' },
  { path: '/reset-password', title: 'Set a new password | Payslip Insights', description: 'Set a new password for your secure Payslip Insights account.' },
  { path: '/onboarding', title: 'Your account | Payslip Insights', description: 'Secure Payslip Insights account area.' },
  { path: '/dashboard', title: 'Your account | Payslip Insights', description: 'Secure Payslip Insights account area.' },
  { path: '/plan', title: 'Your account | Payslip Insights', description: 'Secure Payslip Insights account area.' },
  { path: '/vault', title: 'Your account | Payslip Insights', description: 'Secure Payslip Insights account area.' },
  { path: '/compare', title: 'Your account | Payslip Insights', description: 'Secure Payslip Insights account area.' },
  { path: '/anomalies', title: 'Your account | Payslip Insights', description: 'Secure Payslip Insights account area.' },
  { path: '/settings', title: 'Your account | Payslip Insights', description: 'Secure Payslip Insights account area.' },
  { path: '/checkout', title: 'Your account | Payslip Insights', description: 'Secure Payslip Insights account area.' },
  { path: '/checkout/return', title: 'Your account | Payslip Insights', description: 'Secure Payslip Insights account area.' },
];

/**
 * Pre-renders the public, indexable route whitelist at build time.
 *
 * Each file retains the normal SPA body and module reference, but its head is
 * rewritten with route-specific metadata and JSON-LD. Crawlers and social
 * scrapers therefore receive the right canonical identity before JavaScript
 * runs, while React Router still owns the interactive page after boot.
 */
export function prerenderGuides(): Plugin {
  return {
    name: 'prerender-public-pages',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const indexAsset = bundle['index.html'];
      if (!indexAsset || indexAsset.type !== 'asset') {
        this.warn('[prerender-public-pages] index.html not found in bundle, skipping.');
        return;
      }
      const baseHtml =
        typeof indexAsset.source === 'string'
          ? indexAsset.source
          : new TextDecoder().decode(indexAsset.source);
      const landingPage = STATIC_SEO_PAGES.find((page) => page.path === '/');

      if (!landingPage) {
        this.error('[prerender-public-pages] The landing page is missing from the public SEO whitelist.');
        return;
      }

      // Rewrite the existing root asset rather than emitting a duplicate
      // index.html. Every other indexable page gets its own path/index.html.
      indexAsset.source = rewriteHead(baseHtml, landingPage);

      for (const page of STATIC_SEO_PAGES) {
        if (page.path === '/') continue;

        const fileName = `${page.path.replace(/^\//, '')}/index.html`;
        this.emitFile({
          type: 'asset',
          fileName,
          source: rewriteHead(baseHtml, page),
        });
      }

      for (const page of STATIC_NOINDEX_PAGES) {
        const fileName = `${page.path.replace(/^\//, '')}/index.html`;
        this.emitFile({
          type: 'asset',
          fileName,
          source: rewriteNoIndexHead(baseHtml, page),
        });
      }
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonForScript(json: string): string {
  // Prevent </script> from breaking out of the inline JSON-LD block.
  return json.replace(/</g, '\\u003c');
}

export function rewriteHead(baseHtml: string, page: StaticSeoPage): string {
  const url = `${SITE_ORIGIN}${page.path}`;
  const jsonLd = escapeJsonForScript(JSON.stringify(page.jsonLd));
  let html = baseHtml.replace(PRERENDERED_SCHEMA_PATTERN, '');

  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(page.title)}</title>`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtml(page.description)}">`,
  );
  html = replaceOrInsertLink(
    html,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${url}">`,
  );

  html = replaceOrInsertMeta(
    html,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(page.title)}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(page.description)}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${url}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+property=["']og:type["'][^>]*>/i,
    `<meta property="og:type" content="${page.ogType}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+property=["']og:image["'][^>]*>/i,
    `<meta property="og:image" content="${DEFAULT_OG_IMAGE}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+property=["']og:image:width["'][^>]*>/i,
    `<meta property="og:image:width" content="${DEFAULT_OG_IMAGE_WIDTH}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+property=["']og:image:height["'][^>]*>/i,
    `<meta property="og:image:height" content="${DEFAULT_OG_IMAGE_HEIGHT}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+property=["']og:image:alt["'][^>]*>/i,
    `<meta property="og:image:alt" content="${DEFAULT_OG_IMAGE_ALT}">`,
  );

  html = replaceOrInsertMeta(
    html,
    /<meta\s+name=["']twitter:card["'][^>]*>/i,
    '<meta name="twitter:card" content="summary_large_image">',
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+name=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+name=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+name=["']twitter:image["'][^>]*>/i,
    `<meta name="twitter:image" content="${DEFAULT_OG_IMAGE}">`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+name=["']twitter:image:alt["'][^>]*>/i,
    `<meta name="twitter:image:alt" content="${DEFAULT_OG_IMAGE_ALT}">`,
  );

  const jsonLdTag = `<script type="application/ld+json" id="${PRERENDERED_SCHEMA_ID}">${jsonLd}</script>`;
  return html.replace(/<\/head>/i, `    ${jsonLdTag}\n  </head>`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeHeadTagWithAttribute(
  html: string,
  tagName: 'link' | 'meta',
  attribute: 'name' | 'property' | 'rel',
  value: string,
): string {
  const pattern = new RegExp(
    `<${tagName}\\b(?=[^>]*\\b${attribute}=["']${escapeRegExp(value)}["'])[^>]*>\\s*`,
    'gi',
  );
  return html.replace(pattern, '');
}

/**
 * Rewrites a literal private/recovery/holding route so its first response has
 * no canonical or social identity. React applies the equivalent metadata when
 * it boots; this static version prevents a no-JavaScript crawler from treating
 * the route as a duplicate copy of the public landing page.
 */
export function rewriteNoIndexHead(baseHtml: string, page: StaticNoIndexPage): string {
  let html = baseHtml.replace(PRERENDERED_SCHEMA_PATTERN, '');

  html = removeHeadTagWithAttribute(html, 'link', 'rel', 'canonical');
  for (const property of [
    'og:type',
    'og:title',
    'og:description',
    'og:url',
    'og:site_name',
    'og:image',
    'og:image:width',
    'og:image:height',
    'og:image:alt',
  ]) {
    html = removeHeadTagWithAttribute(html, 'meta', 'property', property);
  }
  for (const name of [
    'description',
    'robots',
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
    'twitter:image:alt',
  ]) {
    html = removeHeadTagWithAttribute(html, 'meta', 'name', name);
  }

  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(page.title)}</title>`,
  );
  html = replaceOrInsertMeta(
    html,
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtml(page.description)}">`,
  );
  return replaceOrInsertMeta(
    html,
    /<meta\s+name=["']robots["'][^>]*>/i,
    '<meta name="robots" content="noindex, nofollow">',
  );
}

function replaceOrInsertMeta(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html)
    ? html.replace(pattern, replacement)
    : html.replace(/<\/head>/i, `    ${replacement}\n  </head>`);
}

function replaceOrInsertLink(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html)
    ? html.replace(pattern, replacement)
    : html.replace(/<\/head>/i, `    ${replacement}\n  </head>`);
}
