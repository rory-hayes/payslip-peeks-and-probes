import { describe, expect, it } from 'vitest';
import {
  DIRECT_ROUTE_CHECKS,
  cleanCheckedOutRevision,
  directRouteResponseIssues,
  expectedTitleFromSource,
  headerIssues,
  inspectPublicCutoverHomePage,
  isCanonicalBuildTimestamp,
  inspectPublicHomePage,
  parsePublicReleaseArguments,
  readResponseTextWithinLimit,
  releaseManifestResponseIssues,
  resolveExpectedReleaseRevision,
  staticNoIndexRouteIssues,
  staticRouteMetadataIssues,
  validateReleaseManifest,
} from '../../scripts/verify-public-web-release.mjs';

const RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567';
const RELEASE_ORIGIN = 'https://payslipinsights.com';
const EXPECTED_TITLE = 'Payslip Insights — Understand and compare your pay';

function cleanManifest(overrides = {}) {
  return {
    builtAt: '2026-08-04T12:00:00.000Z',
    mode: 'production',
    revision: RELEASE_SHA,
    revisionSource: 'git',
    schemaVersion: 2,
    surface: 'web',
    worktree: 'clean',
    ...overrides,
  };
}

describe('public release verification contract', () => {
  it('requires an HTTPS public URL while allowing an explicit clean revision', () => {
    expect(parsePublicReleaseArguments([
      '--url', 'https://payslipinsights.com',
      '--revision', RELEASE_SHA,
    ])).toMatchObject({
      revision: RELEASE_SHA,
      scope: 'release',
    });

    expect(parsePublicReleaseArguments([
      '--url', 'https://payslipinsights.com',
      '--scope', 'cutover',
    ])).toMatchObject({ scope: 'cutover' });

    expect(() => parsePublicReleaseArguments(['--url', 'http://payslipinsights.com']))
      .toThrow(/HTTPS/);
    expect(() => parsePublicReleaseArguments([
      '--url', 'https://payslipinsights.com',
      '--revision', 'short-sha',
    ])).toThrow(/40-character/);
    expect(() => parsePublicReleaseArguments([
      '--url', 'https://payslipinsights.com',
      '--scope', 'partial',
    ])).toThrow(/release or cutover/);

    for (const unsafeUrl of [
      'https://user:password@payslipinsights.com',
      'https://payslipinsights.com/preview',
      'https://payslipinsights.com/?preview=1',
      'https://payslipinsights.com/#preview',
    ]) {
      expect(() => parsePublicReleaseArguments(['--url', unsafeUrl])).toThrow(/HTTPS/);
    }
  });

  it('accepts only a clean production web manifest for the expected revision', () => {
    expect(validateReleaseManifest(cleanManifest(), RELEASE_SHA)).toEqual([]);

    expect(validateReleaseManifest({
      builtAt: 'not-a-date',
      mode: 'development',
      revision: 'stale',
      revisionSource: 'unknown',
      schemaVersion: 1,
      surface: 'mobile',
      worktree: 'dirty',
    }, RELEASE_SHA)).toHaveLength(7);

    expect(validateReleaseManifest(cleanManifest({ builtAt: '1' }), RELEASE_SHA))
      .toEqual(['The deployed release manifest has no valid build timestamp.']);

    for (const falsyJsonValue of [null, false, 0, '']) {
      expect(validateReleaseManifest(falsyJsonValue, RELEASE_SHA))
        .toEqual(['The public release.json is not a JSON object.']);
    }
  });

  it('does not let a falsy JSON release manifest skip validation', async () => {
    for (const falsyJson of ['null', 'false', '0', '""']) {
      await expect(releaseManifestResponseIssues(new Response(falsyJson), RELEASE_SHA))
        .resolves.toEqual(['The public release.json is not a JSON object.']);
    }
  });

  it('accepts only canonical build timestamps', () => {
    expect(isCanonicalBuildTimestamp('2026-08-04T12:00:00.000Z')).toBe(true);
    expect(isCanonicalBuildTimestamp('1')).toBe(false);
    expect(isCanonicalBuildTimestamp('2026-08-04T12:00:00Z')).toBe(false);
    expect(isCanonicalBuildTimestamp('2026-02-30T12:00:00.000Z')).toBe(false);
  });

  it('detects old product claims and known host-level injection', () => {
    const expectedTitle = expectedTitleFromSource(`<title>${EXPECTED_TITLE}</title>`);
    const { issues } = inspectPublicHomePage(`
      <title>Payslip Insights — Understand your payslip, catch payroll mistakes early</title>
      <script src="/~flock.js"></script>
      <aside id="lovable-badge"></aside>
    `, expectedTitle, RELEASE_ORIGIN);

    expect(issues).toEqual(expect.arrayContaining([
      expect.stringMatching(/title/i),
      expect.stringMatching(/retired payroll-mistakes claim/i),
      expect.stringMatching(/Lovable editing badge/i),
      expect.stringMatching(/host-injected analytics/i),
    ]));
  });

  it('accepts the single built module shape emitted by the web release', () => {
    const expectedTitle = EXPECTED_TITLE;
    expect(inspectPublicHomePage(`
      <title>${expectedTitle}</title>
      <div id="root"></div>
      <script type="module" crossorigin src="/assets/index-abc123.js"></script>
    `, expectedTitle, RELEASE_ORIGIN)).toEqual({ issues: [], moduleAssetPath: '/assets/index-abc123.js' });
  });

  it('allows inert JSON-LD beside the application module while rejecting injected executable scripts', () => {
    const withStructuredData = `
      <title>${EXPECTED_TITLE}</title>
      <div id="root"></div>
      <script type="module" crossorigin src="/assets/index-abc123.js"></script>
      <script type="application/ld+json" id="prerendered-seo-schema">{"@type":"WebSite"}</script>
    `;

    expect(inspectPublicHomePage(withStructuredData, EXPECTED_TITLE, RELEASE_ORIGIN))
      .toEqual({ issues: [], moduleAssetPath: '/assets/index-abc123.js' });

    expect(inspectPublicHomePage(`${withStructuredData}<script>window.hostBadge = true;</script>`, EXPECTED_TITLE, RELEASE_ORIGIN).issues)
      .toContain('The public page contains an additional executable script outside the reviewed application module.');
  });

  it('allows host-owned scripts only for the secure-client cutover check', () => {
    const html = `
      <title>${EXPECTED_TITLE}</title>
      <div id="root"></div>
      <script type="module" crossorigin src="/assets/index-secure123.js"></script>
      <script src="/~flock.js"></script>
      <aside id="lovable-badge"></aside>
    `;

    expect(inspectPublicCutoverHomePage(html, EXPECTED_TITLE, RELEASE_ORIGIN))
      .toEqual({ issues: [], moduleAssetPath: '/assets/index-secure123.js' });
    expect(inspectPublicHomePage(html, EXPECTED_TITLE, RELEASE_ORIGIN).issues)
      .toEqual(expect.arrayContaining([
        expect.stringMatching(/Lovable editing badge/i),
        expect.stringMatching(/host-injected analytics/i),
      ]));
  });

  it('rejects external, protocol-relative, and non-canonical application module sources', () => {
    for (const source of [
      'https://release-verification.invalid/assets/index.js',
      '//release-verification.invalid/assets/index.js',
      '/assets/index.js?host-injected=1',
    ]) {
      const { issues, moduleAssetPath } = inspectPublicHomePage(`
        <title>${EXPECTED_TITLE}</title>
        <div id="root"></div>
        <script type="module" src="${source}"></script>
      `, EXPECTED_TITLE, RELEASE_ORIGIN);

      expect(moduleAssetPath).toBeNull();
      expect(issues).toContain('The public page application script must be a same-origin asset under /assets/.');
    }
  });

  it('requires a durable HSTS policy alongside the other public headers', () => {
    const secureHeaders = new Headers({
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
    expect(headerIssues(secureHeaders)).toEqual([]);

    const weakHstsHeaders = new Headers({
      'strict-transport-security': 'max-age=0',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    });
    expect(headerIssues(weakHstsHeaders)).toEqual([
      'The public page needs Strict-Transport-Security with max-age of at least 31536000.',
    ]);
  });

  it('requires representative direct routes to return an HTML app shell', () => {
    expect(directRouteResponseIssues(
      new Response('<!doctype html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      'pricing',
    )).toEqual([]);

    expect(directRouteResponseIssues(new Response('Not found', { status: 404 }), 'sign-in'))
      .toEqual(['The public sign-in route returned HTTP 404.']);
    expect(directRouteResponseIssues(
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
      'guide',
    )).toEqual(['The public guide route is not served as HTML.']);
  });

  it('requires indexable direct routes to expose their own pre-hydration metadata', () => {
    const pricing = DIRECT_ROUTE_CHECKS.find((route) => route.path === '/pricing');
    if (!pricing) throw new Error('Expected pricing release route.');

    const routeHtml = `
      <link rel="canonical" href="https://payslipinsights.com/pricing">
      <meta property="og:url" content="https://payslipinsights.com/pricing">
      <meta property="og:type" content="website">
      <meta property="og:image" content="https://payslipinsights.com/og-default.png">
      <meta name="twitter:image" content="https://payslipinsights.com/og-default.png">
      <script type="application/ld+json" id="prerendered-seo-schema">{}</script>
    `;

    expect(staticRouteMetadataIssues(routeHtml, pricing, RELEASE_ORIGIN)).toEqual([]);
    expect(staticRouteMetadataIssues('<title>Home shell</title>', pricing, RELEASE_ORIGIN))
      .toEqual(expect.arrayContaining([
        expect.stringMatching(/canonical/i),
        expect.stringMatching(/Open Graph URL/i),
        expect.stringMatching(/structured-data/i),
      ]));
  });

  it('requires direct account and recovery routes to serve noindex metadata before hydration', () => {
    const signIn = DIRECT_ROUTE_CHECKS.find((route) => route.path === '/sign-in');
    if (!signIn) throw new Error('Expected sign-in release route.');

    expect(staticNoIndexRouteIssues(`
      <meta name="robots" content="noindex, nofollow">
      <title>Sign in | Payslip Insights</title>
    `, signIn)).toEqual([]);

    expect(staticNoIndexRouteIssues(`
      <link rel="canonical" href="https://payslipinsights.com/">
      <meta property="og:title" content="Payslip Insights">
      <script type="application/ld+json" id="prerendered-seo-schema">{}</script>
    `, signIn)).toEqual(expect.arrayContaining([
      expect.stringMatching(/noindex/i),
      expect.stringMatching(/canonical/i),
      expect.stringMatching(/sharing/i),
      expect.stringMatching(/structured data/i),
    ]));
  });

  it('binds an explicit release revision to the clean checked-out source', () => {
    const gitRunner = (args: string[]) => (args[0] === 'status' ? '' : RELEASE_SHA);
    expect(cleanCheckedOutRevision(gitRunner)).toBe(RELEASE_SHA);
    expect(resolveExpectedReleaseRevision(RELEASE_SHA, RELEASE_SHA)).toBe(RELEASE_SHA);
    expect(() => resolveExpectedReleaseRevision('fedcba9876543210fedcba9876543210fedcba98', RELEASE_SHA))
      .toThrow(/must match/);
    expect(() => cleanCheckedOutRevision(() => ' M index.html')).toThrow(/clean Git release worktree/);
  });

  it('caps public response bodies before parsing them', async () => {
    await expect(readResponseTextWithinLimit(new Response('safe'), 4, 'home page')).resolves.toBe('safe');
    await expect(readResponseTextWithinLimit(
      new Response('too-large', { headers: { 'content-length': '9' } }),
      8,
      'release manifest',
    )).rejects.toThrow(/safety limit/);
    await expect(readResponseTextWithinLimit(new Response('chunked'), 6, 'home page'))
      .rejects.toThrow(/safety limit/);
  });
});
