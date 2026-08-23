import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_MANIFEST_BYTES = 32 * 1024;
const MAX_HOME_PAGE_BYTES = 512 * 1024;
const REQUIRED_SCHEMA_VERSION = 2;
const MIN_HSTS_MAX_AGE_SECONDS = 31_536_000;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const CANONICAL_ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const DIRECT_ROUTE_CHECKS = [
  { label: 'guides hub', path: '/guides', staticMetadata: true, ogType: 'website' },
  { label: 'guide', path: '/guides/how-to-check-your-payslip', staticMetadata: true, ogType: 'article' },
  { label: 'pricing', path: '/pricing', staticMetadata: true, ogType: 'website' },
  { label: 'sign-in', path: '/sign-in', staticNoIndex: true },
  { label: 'protected-route shell', path: '/dashboard', staticNoIndex: true },
];

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readOption(argv, name) {
  const equalsPrefix = `--${name}=`;
  const equalsValue = argv.find((value) => value.startsWith(equalsPrefix));
  if (equalsValue) return equalsValue.slice(equalsPrefix.length);

  const index = argv.indexOf(`--${name}`);
  return index === -1 ? null : argv[index + 1] ?? null;
}

export function parsePublicReleaseArguments(argv) {
  const url = nonEmptyString(readOption(argv, 'url'));
  const revision = nonEmptyString(readOption(argv, 'revision'));

  if (!url) throw new Error('Pass the public site with --url https://payslipinsights.com.');

  let publicUrl;
  try {
    publicUrl = new URL(url);
  } catch {
    throw new Error('--url must be a valid HTTPS URL.');
  }

  if (
    publicUrl.protocol !== 'https:'
    || !publicUrl.hostname
    || publicUrl.username
    || publicUrl.password
    || publicUrl.pathname !== '/'
    || publicUrl.search
    || publicUrl.hash
  ) {
    throw new Error('--url must be a valid HTTPS URL.');
  }
  if (revision && !GIT_SHA_PATTERN.test(revision)) {
    throw new Error('--revision must be the full 40-character lowercase Git commit SHA.');
  }

  return { publicUrl, revision };
}

export function expectedTitleFromSource(source) {
  const match = source.match(/<title>([^<]+)<\/title>/i);
  const title = nonEmptyString(match?.[1]);
  if (!title) throw new Error('Could not read the expected <title> from index.html.');
  return title;
}

export function isCanonicalBuildTimestamp(value) {
  if (typeof value !== 'string' || !CANONICAL_ISO_TIMESTAMP_PATTERN.test(value)) return false;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function validateReleaseManifest(value, expectedRevision) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['The public release.json is not a JSON object.'];
  }

  const manifest = value;
  if (manifest.schemaVersion !== REQUIRED_SCHEMA_VERSION) {
    issues.push(`Expected release schema version ${REQUIRED_SCHEMA_VERSION}.`);
  }
  if (manifest.surface !== 'web') issues.push('The deployed release manifest is not for the web surface.');
  if (manifest.mode !== 'production') issues.push('The deployed release manifest is not a production build.');
  if (!['git', 'configured'].includes(manifest.revisionSource)) {
    issues.push('The deployed release manifest has no trustworthy revision source.');
  }
  if (manifest.worktree !== 'clean') issues.push('The deployed release manifest does not attest to a clean worktree.');
  if (manifest.revision !== expectedRevision) {
    issues.push(`The deployed revision does not match ${expectedRevision}.`);
  }
  if (!isCanonicalBuildTimestamp(manifest.builtAt)) {
    issues.push('The deployed release manifest has no valid build timestamp.');
  }

  return issues;
}

export function inspectPublicHomePage(html, expectedTitle, publicOrigin) {
  const trustedOrigin = new URL(publicOrigin).origin;
  const issues = [];
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const publicTitle = nonEmptyString(titleMatch?.[1]);
  if (publicTitle !== expectedTitle) {
    issues.push(`The public page title does not match the release source (${expectedTitle}).`);
  }
  if (!/<div\b[^>]*\bid=["']root["'][^>]*><\/div>/i.test(html)) {
    issues.push('The public page is missing the application root.');
  }

  if (/catch payroll mistakes early/i.test(html)) {
    issues.push('The public page still contains the retired payroll-mistakes claim.');
  }
  if (/id=["']lovable-badge["']|lovable\.dev\/projects/i.test(html)) {
    issues.push('The public page still contains a Lovable editing badge.');
  }
  if (/\/~flock\.js|data-proxy-url=["']\/~api\/analytics/i.test(html)) {
    issues.push('The public page contains host-injected analytics outside the app consent flow.');
  }
  if (/\/src\/main\.tsx/i.test(html)) {
    issues.push('The public page is serving a development entrypoint rather than built assets.');
  }

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  if (scripts.length !== 1) {
    issues.push('The public page must contain exactly one static application module script.');
    return { issues, moduleAssetPath: null };
  }

  const [, attributes, inlineContent] = scripts[0];
  const source = attributes.match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? null;
  const isModule = /\btype=["']module["']/i.test(attributes);
  if (!isModule || !source || inlineContent.trim()) {
    issues.push('The public page application script must be a non-inline ES module asset.');
    return { issues, moduleAssetPath: null };
  }

  if (!source.startsWith('/') || source.startsWith('//')) {
    issues.push('The public page application script must be a same-origin asset under /assets/.');
    return { issues, moduleAssetPath: null };
  }

  let moduleAsset;
  try {
    moduleAsset = new URL(source, trustedOrigin);
  } catch {
    issues.push('The public page application script has an invalid asset path.');
    return { issues, moduleAssetPath: null };
  }

  if (
    moduleAsset.origin !== trustedOrigin
    || !moduleAsset.pathname.startsWith('/assets/')
    || moduleAsset.search
    || moduleAsset.hash
  ) {
    issues.push('The public page application script must be a same-origin asset under /assets/.');
    return { issues, moduleAssetPath: null };
  }

  return { issues, moduleAssetPath: `${moduleAsset.pathname}${moduleAsset.search}` };
}

export function headerIssues(headers) {
  const issues = [];
  const hsts = headers.get('strict-transport-security');
  const maxAge = hsts?.match(/(?:^|;)\s*max-age\s*=\s*(\d+)\s*(?:;|$)/i)?.[1];
  if (!maxAge || Number(maxAge) < MIN_HSTS_MAX_AGE_SECONDS) {
    issues.push(`The public page needs Strict-Transport-Security with max-age of at least ${MIN_HSTS_MAX_AGE_SECONDS}.`);
  }
  if (headers.get('x-content-type-options')?.toLowerCase() !== 'nosniff') {
    issues.push('The public page is missing X-Content-Type-Options: nosniff.');
  }

  const referrerPolicy = headers.get('referrer-policy')?.toLowerCase();
  if (!referrerPolicy || !['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'].includes(referrerPolicy)) {
    issues.push('The public page needs a restrictive Referrer-Policy.');
  }

  return issues;
}

export function directRouteResponseIssues(response, label) {
  const issues = [];
  if (!response.ok) {
    issues.push(`The public ${label} route returned HTTP ${response.status}.`);
    return issues;
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
    issues.push(`The public ${label} route is not served as HTML.`);
  }
  return issues;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function htmlTagWithAttribute(html, tagName, attribute, expectedValue) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];
  const matcher = new RegExp(
    `\\b${escapeRegExp(attribute)}\\s*=\\s*["']${escapeRegExp(expectedValue)}["']`,
    'i',
  );
  return tags.find((tag) => matcher.test(tag)) ?? null;
}

function htmlAttribute(tag, attribute) {
  if (!tag) return null;
  const match = tag.match(new RegExp(`\\b${escapeRegExp(attribute)}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match?.[1] ?? null;
}

/**
 * Checks the HTML response itself, not the SPA's post-hydration DOM. This
 * proves the host served a route-specific static document before its fallback
 * rule can collapse every public route back to the home-page shell.
 */
export function staticRouteMetadataIssues(html, route, publicOrigin) {
  if (!route.staticMetadata) return [];

  const expectedUrl = new URL(route.path, publicOrigin).href;
  const expectedImage = new URL('/og-default.png', publicOrigin).href;
  const issues = [];
  const canonical = htmlAttribute(htmlTagWithAttribute(html, 'link', 'rel', 'canonical'), 'href');
  const ogUrl = htmlAttribute(htmlTagWithAttribute(html, 'meta', 'property', 'og:url'), 'content');
  const ogType = htmlAttribute(htmlTagWithAttribute(html, 'meta', 'property', 'og:type'), 'content');
  const ogImage = htmlAttribute(htmlTagWithAttribute(html, 'meta', 'property', 'og:image'), 'content');
  const twitterImage = htmlAttribute(htmlTagWithAttribute(html, 'meta', 'name', 'twitter:image'), 'content');
  const schemaCount = (html.match(/<script[^>]+id=["']prerendered-seo-schema["'][^>]*>[\s\S]*?<\/script>/gi) ?? []).length;

  if (canonical !== expectedUrl) {
    issues.push(`The public ${route.label} route is missing its route-specific canonical URL.`);
  }
  if (ogUrl !== expectedUrl) {
    issues.push(`The public ${route.label} route is missing its route-specific Open Graph URL.`);
  }
  if (ogType !== route.ogType) {
    issues.push(`The public ${route.label} route has the wrong Open Graph type.`);
  }
  if (ogImage !== expectedImage || twitterImage !== expectedImage) {
    issues.push(`The public ${route.label} route is missing the release social-image metadata.`);
  }
  if (schemaCount !== 1) {
    issues.push(`The public ${route.label} route must contain exactly one static structured-data payload.`);
  }

  return issues;
}

/**
 * Literal recovery and account routes should not inherit the landing page's
 * canonical or social-card metadata before the SPA boots.
 */
export function staticNoIndexRouteIssues(html, route) {
  if (!route.staticNoIndex) return [];

  const issues = [];
  const robots = htmlAttribute(htmlTagWithAttribute(html, 'meta', 'name', 'robots'), 'content');
  const canonical = htmlTagWithAttribute(html, 'link', 'rel', 'canonical');
  const hasSharingMetadata = /<meta\b[^>]*(?:\bproperty=["']og:|\bname=["']twitter:)[^>]*>/i.test(html);
  const schemaCount = (html.match(/<script[^>]+id=["']prerendered-(?:article|page|seo)-schema["'][^>]*>[\s\S]*?<\/script>/gi) ?? []).length;

  if (robots !== 'noindex, nofollow') {
    issues.push(`The public ${route.label} route is missing its static noindex directive.`);
  }
  if (canonical) {
    issues.push(`The public ${route.label} route must not expose a canonical URL.`);
  }
  if (hasSharingMetadata) {
    issues.push(`The public ${route.label} route must not expose public sharing metadata.`);
  }
  if (schemaCount !== 0) {
    issues.push(`The public ${route.label} route must not expose static structured data.`);
  }

  return issues;
}

function declaredContentLength(response) {
  const rawValue = response.headers.get('content-length')?.trim();
  if (!rawValue || !/^\d+$/.test(rawValue)) return null;

  const length = Number(rawValue);
  return Number.isSafeInteger(length) ? length : null;
}

async function cancelReader(reader) {
  try {
    await reader.cancel();
  } catch {
    // A failed cancellation should not obscure the original size failure.
  }
}

export async function readResponseTextWithinLimit(response, maxBytes, label) {
  const contentLength = declaredContentLength(response);
  if (contentLength !== null && contentLength > maxBytes) {
    await discardResponseBody(response);
    throw new Error(`The public ${label} exceeds the ${maxBytes}-byte safety limit.`);
  }

  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await cancelReader(reader);
        throw new Error(`The public ${label} exceeds the ${maxBytes}-byte safety limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function releaseManifestResponseIssues(response, expectedRevision) {
  try {
    const manifestText = await readResponseTextWithinLimit(response, MAX_MANIFEST_BYTES, 'release manifest');
    return validateReleaseManifest(JSON.parse(manifestText), expectedRevision);
  } catch (error) {
    if (error instanceof Error && error.message.includes('safety limit')) {
      return [error.message];
    }
    return ['The public release manifest is not valid JSON.'];
  }
}

function revalidationCacheIssue(response) {
  const cacheControl = response.headers.get('cache-control')?.toLowerCase() ?? '';
  return /(?:^|,)\s*(?:no-store|no-cache|max-age=0)(?:,|$)/.test(cacheControl)
    ? null
    : 'The public release manifest must require revalidation with Cache-Control: no-store, no-cache, or max-age=0.';
}

async function fetchWithTimeout(url, accept) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { Accept: accept },
      redirect: 'error',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function discardResponseBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // There is no customer data in this response, and a failed cancellation
    // should not hide a real release-verification result.
  }
}

function gitOutput(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export function cleanCheckedOutRevision(gitRunner = gitOutput) {
  if (gitRunner(['status', '--porcelain'])) {
    throw new Error('Run this command from a clean Git release worktree.');
  }

  const revision = gitRunner(['rev-parse', 'HEAD']);
  if (!GIT_SHA_PATTERN.test(revision)) {
    throw new Error('The clean release worktree does not have a full Git commit SHA.');
  }

  return revision;
}

export function resolveExpectedReleaseRevision(requestedRevision, checkedOutRevision) {
  if (requestedRevision && requestedRevision !== checkedOutRevision) {
    throw new Error('--revision must match the checked-out clean release worktree.');
  }

  return requestedRevision ?? checkedOutRevision;
}

function rootUrl(publicUrl) {
  return new URL('/', publicUrl.origin);
}

function releaseManifestUrl(publicUrl) {
  const url = new URL('/release.json', publicUrl.origin);
  // A fresh query avoids mistaking a cached release receipt for a current
  // deployment. It contains no customer or configuration data.
  url.searchParams.set('_release_check', String(Date.now()));
  return url;
}

function directRouteUrl(publicUrl, path) {
  return new URL(path, publicUrl.origin);
}

function assertExpectedResponseUrl(response, expectedUrl, label) {
  const actual = new URL(response.url);
  if (actual.origin !== expectedUrl.origin || actual.pathname !== expectedUrl.pathname || actual.search !== expectedUrl.search) {
    throw new Error(`${label} must not redirect away from its expected public URL.`);
  }
}

async function main() {
  const { publicUrl, revision: requestedRevision } = parsePublicReleaseArguments(process.argv.slice(2));
  const checkedOutRevision = cleanCheckedOutRevision();
  const expectedRevision = resolveExpectedReleaseRevision(requestedRevision, checkedOutRevision);

  const expectedTitle = expectedTitleFromSource(readFileSync('index.html', 'utf8'));
  const root = rootUrl(publicUrl);
  const manifestUrl = releaseManifestUrl(publicUrl);
  const directRoutes = DIRECT_ROUTE_CHECKS.map((route) => ({
    ...route,
    url: directRouteUrl(publicUrl, route.path),
  }));
  const [manifestResponse, homeResponse, directRouteResponses] = await Promise.all([
    fetchWithTimeout(manifestUrl, 'application/json'),
    fetchWithTimeout(root, 'text/html'),
    Promise.all(directRoutes.map(async (route) => ({
      ...route,
      response: await fetchWithTimeout(route.url, 'text/html'),
    }))),
  ]);

  const issues = [];
  if (!manifestResponse.ok) {
    issues.push(`The public release manifest returned HTTP ${manifestResponse.status}.`);
  } else {
    assertExpectedResponseUrl(manifestResponse, manifestUrl, 'release.json');
    if (!manifestResponse.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      issues.push('The public release manifest is not served as JSON.');
    }
    const cacheIssue = revalidationCacheIssue(manifestResponse);
    if (cacheIssue) issues.push(cacheIssue);
    issues.push(...await releaseManifestResponseIssues(manifestResponse, expectedRevision));
  }

  if (!homeResponse.ok) {
    issues.push(`The public home page returned HTTP ${homeResponse.status}.`);
  } else {
    assertExpectedResponseUrl(homeResponse, root, 'home page');
    if (!homeResponse.headers.get('content-type')?.toLowerCase().includes('text/html')) {
      issues.push('The public home page is not served as HTML.');
    }
    issues.push(...headerIssues(homeResponse.headers));
    let homePage;
    try {
      const homeHtml = await readResponseTextWithinLimit(homeResponse, MAX_HOME_PAGE_BYTES, 'home page');
      homePage = inspectPublicHomePage(homeHtml, expectedTitle, root.origin);
      issues.push(...homePage.issues);
    } catch (error) {
      if (error instanceof Error && error.message.includes('safety limit')) {
        issues.push(error.message);
      } else {
        issues.push('The public home page could not be read safely.');
      }
    }

    if (homePage?.moduleAssetPath) {
      const assetUrl = new URL(homePage.moduleAssetPath, root);
      const assetResponse = await fetchWithTimeout(assetUrl, 'text/javascript, application/javascript;q=0.9');
      if (!assetResponse.ok) {
        issues.push(`The public application module returned HTTP ${assetResponse.status}.`);
      } else {
        assertExpectedResponseUrl(assetResponse, assetUrl, 'application module');
        const contentType = assetResponse.headers.get('content-type')?.toLowerCase() ?? '';
        if (!/(?:text|application)\/javascript/.test(contentType)) {
          issues.push('The public application module is not served as JavaScript.');
        }
      }
      await discardResponseBody(assetResponse);
    }
  }

  for (const route of directRouteResponses) {
    const { label, url, response } = route;
    if (response.ok) {
      assertExpectedResponseUrl(response, url, `${label} route`);
    }
    issues.push(...directRouteResponseIssues(response, label));

    if (response.ok && (route.staticMetadata || route.staticNoIndex)) {
      try {
        const html = await readResponseTextWithinLimit(response, MAX_HOME_PAGE_BYTES, `${label} route`);
        issues.push(...staticRouteMetadataIssues(html, route, root.origin));
        issues.push(...staticNoIndexRouteIssues(html, route));
      } catch (error) {
        issues.push(error instanceof Error && error.message.includes('safety limit')
          ? error.message
          : `The public ${label} route could not be read safely.`);
      }
    } else {
      await discardResponseBody(response);
    }
  }

  if (issues.length > 0) {
    console.error('\nPublic web release verification failed:\n');
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
    return;
  }

  console.log('\nPublic web release verification passed.');
  console.log(`- URL: ${root.origin}`);
  console.log(`- Revision: ${expectedRevision}`);
  console.log('- Release manifest: production web build from a clean worktree');
  console.log('- Public page: expected title, built application module, no known host injection, and restrictive headers');
  console.log('- Direct routes: indexable routes serve distinct static metadata; sign-in and protected-route shells serve static noindex HTML without a host redirect');
  console.log('\nThis verifies the deployed public shell only. It does not prove authentication, payslip processing, storage isolation, Stripe, or deletion flows.');
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`\nPublic web release verification could not run: ${error instanceof Error ? error.message : 'Unknown error.'}`);
    process.exitCode = 1;
  });
}
