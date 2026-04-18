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

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

interface SeoOptions {
  title: string;
  description: string;
  /** Defaults to current pathname */
  canonicalPath?: string;
  /** Optional JSON-LD object (rendered as a single application/ld+json script tag, replacing prior PayCheck-managed one) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const JSON_LD_ID = 'paycheck-jsonld';

export function applySeo({ title, description, canonicalPath, jsonLd }: SeoOptions) {
  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);

  const path = canonicalPath ?? window.location.pathname;
  upsertLink('canonical', window.location.origin + path);

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
