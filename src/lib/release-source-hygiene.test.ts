import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');

function projectFile(path: string) {
  return resolve(projectRoot, path);
}

function cssHexVariable(source: string, name: string) {
  const value = source.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, 'i'))?.[1];
  if (!value) throw new Error(`Missing CSS colour variable: ${name}`);
  return value;
}

function relativeLuminance(hex: string) {
  const channels = hex.match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid six-digit colour: ${hex}`);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe('release source hygiene', () => {
  it('does not retain the unused Lovable placeholder page or static asset', () => {
    expect(existsSync(projectFile('src/pages/Index.tsx'))).toBe(false);
    expect(existsSync(projectFile('public/placeholder.svg'))).toBe(false);
  });

  it('does not enable Lovable development tagging in the owned Vite build', () => {
    const viteConfig = readFileSync(projectFile('vite.config.ts'), 'utf8');
    const packageJson = JSON.parse(readFileSync(projectFile('package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(viteConfig).not.toMatch(/lovable-tagger|componentTagger/);
    expect(packageJson.dependencies?.['@lovable.dev/cloud-auth-js']).toBeUndefined();
    expect(packageJson.devDependencies?.['lovable-tagger']).toBeUndefined();
  });

  it('serves the Payslip Insights favicon with a cache-busting URL', () => {
    const indexHtml = readFileSync(projectFile('index.html'), 'utf8');
    const brandAssets = readFileSync(projectFile('src/lib/brand-assets.ts'), 'utf8');
    const visibleBrandFiles = [
      'src/pages/Landing.tsx',
      'src/components/BrandLockup.tsx',
      'src/components/AppErrorBoundary.tsx',
      'src/components/layout/AppLayout.tsx',
    ].map((path) => readFileSync(projectFile(path), 'utf8')).join('\n');

    expect(indexHtml).toContain('/favicon.svg?v=payslip-insights-1');
    expect(indexHtml).toContain('/favicon.png?v=payslip-insights-1');
    expect(indexHtml).not.toMatch(/lovable[^<]*(?:favicon|icon)/i);
    expect(brandAssets).toContain("'/favicon.png?v=payslip-insights-1'");
    expect(visibleBrandFiles).not.toContain('payslip-insights-mark.png');
  });

  it('keeps the web release on its reviewed npm dependency lockfile', () => {
    expect(existsSync(projectFile('package-lock.json'))).toBe(true);
    expect(existsSync(projectFile('bun.lock'))).toBe(false);
    expect(existsSync(projectFile('bun.lockb'))).toBe(false);
  });

  it('keeps the web release gate aligned with the latest reviewed-detail migration', () => {
    const preflight = readFileSync(projectFile('scripts/release-web-preflight.mjs'), 'utf8');
    const readme = readFileSync(projectFile('README.md'), 'utf8');
    const latestMigration = '20260828210000_reviewed_anomaly_checks.sql';

    expect(existsSync(projectFile(`supabase/migrations/${latestMigration}`))).toBe(true);
    expect(preflight).toContain(`const REQUIRED_MIGRATION = "${latestMigration}"`);
    expect(readme).toContain('every reviewed migration through');
    expect(readme).toContain(latestMigration);
  });

  it('keeps the secure storage migration behind an exact-client cutover gate', () => {
    const deployment = readFileSync(projectFile('scripts/deploy-supabase.mjs'), 'utf8');
    const lockdownMigration = '20260804115000_lock_down_direct_payslip_storage.sql';

    expect(deployment).toContain(`LOCKDOWN_MIGRATION = '${lockdownMigration}'`);
    expect(deployment).toContain("const PHASES = new Set(['prepare', 'functions', 'lockdown'])");
    expect(deployment).toContain("'--scope',\n          'cutover'");
    expect(deployment.indexOf('release:web:verify-public'))
      .toBeLessThan(deployment.indexOf("lockdownOnly: true"));
  });

  it('keeps the landing primary action and orange text at AA contrast', () => {
    const landingCss = readFileSync(projectFile('src/pages/Landing.css'), 'utf8');
    const ink = cssHexVariable(landingCss, 'pi-ink');
    const orange = cssHexVariable(landingCss, 'pi-orange');
    const orangeHover = cssHexVariable(landingCss, 'pi-orange-hover');
    const orangeDark = cssHexVariable(landingCss, 'pi-orange-dark');

    expect(landingCss).toMatch(/\.pi-landing \.pi-landing__button\s*\{[^}]*color:\s*var\(--pi-ink\)/s);
    expect(contrastRatio(ink, orange)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink, orangeHover)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(orangeDark, 'ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
