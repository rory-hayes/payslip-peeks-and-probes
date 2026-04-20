import type { Plugin } from 'vite';
import {
  GUIDES_SEO,
  SITE_ORIGIN,
  TITLE_SUFFIX,
  buildArticleJsonLd,
  type GuideSeo,
} from '../src/lib/guide-seo-data';

/**
 * Pre-renders an HTML file for each guide route at build time.
 *
 * Strategy: take the bundled `index.html` Vite emits, then for every guide
 * path emit a copy at `<path>/index.html` with the head section rewritten to
 * include the correct <title>, <meta name="description">, canonical link,
 * Open Graph + Twitter tags, and a JSON-LD Article <script>.
 *
 * The body (and the React bundle reference) is unchanged, so the SPA still
 * boots normally and React Router takes over after hydration. This gives
 * Googlebot and AI crawlers the SEO payload on the first HTML response.
 */
export function prerenderGuides(): Plugin {
  return {
    name: 'prerender-guides',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const indexAsset = bundle['index.html'];
      if (!indexAsset || indexAsset.type !== 'asset') {
        this.warn('[prerender-guides] index.html not found in bundle, skipping.');
        return;
      }
      const baseHtml =
        typeof indexAsset.source === 'string'
          ? indexAsset.source
          : new TextDecoder().decode(indexAsset.source);

      for (const guide of GUIDES_SEO) {
        const html = rewriteHead(baseHtml, guide);
        // path looks like "/guides/uk-payslip-guide" — emit at "guides/uk-payslip-guide/index.html"
        const fileName = guide.path.replace(/^\//, '') + '/index.html';
        this.emitFile({
          type: 'asset',
          fileName,
          source: html,
        });
      }
    },
  };
}

function escapeHtml(s: string): string {
  return s
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

function rewriteHead(baseHtml: string, guide: GuideSeo): string {
  const fullTitle = guide.title + TITLE_SUFFIX;
  const url = SITE_ORIGIN + guide.path;
  const desc = guide.description;
  const jsonLd = escapeJsonForScript(JSON.stringify(buildArticleJsonLd(guide)));

  let html = baseHtml;

  // <title>
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(fullTitle)}</title>`,
  );

  // meta description
  html = replaceOrInsertMeta(html, /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtml(desc)}">`);

  // canonical
  html = replaceOrInsertLink(html, /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${url}">`);

  // OG
  html = replaceOrInsertMeta(html, /<meta\s+property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}">`);
  html = replaceOrInsertMeta(html, /<meta\s+property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(desc)}">`);
  html = replaceOrInsertMeta(html, /<meta\s+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${url}">`);
  html = replaceOrInsertMeta(html, /<meta\s+property=["']og:type["'][^>]*>/i,
    `<meta property="og:type" content="article">`);

  // Twitter
  html = replaceOrInsertMeta(html, /<meta\s+name=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(fullTitle)}">`);
  html = replaceOrInsertMeta(html, /<meta\s+name=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(desc)}">`);

  // JSON-LD: insert (or replace existing prerendered one) right before </head>
  const jsonLdTag = `<script type="application/ld+json" id="prerendered-article-schema">${jsonLd}</script>`;
  if (/<script[^>]+id=["']prerendered-article-schema["'][^>]*>[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(
      /<script[^>]+id=["']prerendered-article-schema["'][^>]*>[\s\S]*?<\/script>/i,
      jsonLdTag,
    );
  } else {
    html = html.replace(/<\/head>/i, `    ${jsonLdTag}\n  </head>`);
  }

  return html;
}

function replaceOrInsertMeta(html: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace(/<\/head>/i, `    ${replacement}\n  </head>`);
}

function replaceOrInsertLink(html: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace(/<\/head>/i, `    ${replacement}\n  </head>`);
}
