/**
 * Lightweight head-tag helpers for SPA pages. We don't pull in react-helmet to
 * keep the bundle small — the head only ever has one set of meta tags at a time
 * since marketing pages are full-screen and one-at-a-time.
 */

function upsertMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function removeLink(rel: string) {
  document.head.querySelector(`link[rel="${rel}"]`)?.remove();
}

interface SeoOptions {
  title: string;
  description: string;
  /** Defaults to current pathname. Set null for private or noindex routes. */
  canonicalPath?: string | null;
  /** Keeps private, recovery, unavailable, and error routes out of search. */
  noIndex?: boolean;
  /** Optional JSON-LD object (rendered as a single application/ld+json script tag, replacing the prior Payslip Insights-managed one) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const JSON_LD_ID = 'paycheck-jsonld';
const PRERENDERED_JSON_LD_IDS = [
  'prerendered-article-schema',
  'prerendered-page-schema',
  'prerendered-seo-schema',
] as const;
const DEFAULT_OG_IMAGE_PATH = '/og-default.png';
const DEFAULT_OG_IMAGE_WIDTH = '1731';
const DEFAULT_OG_IMAGE_HEIGHT = '909';
const DEFAULT_OG_IMAGE_ALT = 'An illustrated payslip being checked with a clear trend card';

export function applySeo({ title, description, canonicalPath, noIndex = false, jsonLd }: SeoOptions) {
  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);

  const path = canonicalPath === undefined ? window.location.pathname : canonicalPath;
  if (path === null) {
    removeLink('canonical');
    removeMeta('property', 'og:url');
  } else {
    const absoluteUrl = window.location.origin + path;
    upsertLink('canonical', absoluteUrl);
    upsertMeta('property', 'og:url', absoluteUrl);
  }

  if (noIndex) {
    upsertMeta('name', 'robots', 'noindex, nofollow');
    removeMeta('property', 'og:image');
    removeMeta('property', 'og:image:width');
    removeMeta('property', 'og:image:height');
    removeMeta('property', 'og:image:alt');
    removeMeta('name', 'twitter:image');
    removeMeta('name', 'twitter:image:alt');
  } else {
    removeMeta('name', 'robots');
    const imageUrl = window.location.origin + DEFAULT_OG_IMAGE_PATH;
    upsertMeta('property', 'og:image', imageUrl);
    upsertMeta('property', 'og:image:width', DEFAULT_OG_IMAGE_WIDTH);
    upsertMeta('property', 'og:image:height', DEFAULT_OG_IMAGE_HEIGHT);
    upsertMeta('property', 'og:image:alt', DEFAULT_OG_IMAGE_ALT);
    upsertMeta('name', 'twitter:image', imageUrl);
    upsertMeta('name', 'twitter:image:alt', DEFAULT_OG_IMAGE_ALT);
  }

  // Static route files carry a build-time payload for crawlers without
  // JavaScript. Once the SPA takes over, replace it with this managed payload
  // so client navigation cannot leave stale or duplicate structured data.
  PRERENDERED_JSON_LD_IDS.forEach((id) => document.getElementById(id)?.remove());

  // Replace any existing JSON-LD we own; remove if not provided.
  const existing = document.getElementById(JSON_LD_ID);
  if (existing) existing.remove();
  if (jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}
