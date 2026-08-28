import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');

function projectFile(path: string) {
  return resolve(projectRoot, path);
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

    expect(indexHtml).toContain('/favicon.svg?v=payslip-insights-1');
    expect(indexHtml).toContain('/favicon.png?v=payslip-insights-1');
    expect(indexHtml).not.toMatch(/lovable[^<]*(?:favicon|icon)/i);
  });

  it('keeps the web release on its reviewed npm dependency lockfile', () => {
    expect(existsSync(projectFile('package-lock.json'))).toBe(true);
    expect(existsSync(projectFile('bun.lock'))).toBe(false);
    expect(existsSync(projectFile('bun.lockb'))).toBe(false);
  });

  it('keeps the web release gate aligned with the latest two-check quota migration', () => {
    const preflight = readFileSync(projectFile('scripts/release-web-preflight.mjs'), 'utf8');
    const readme = readFileSync(projectFile('README.md'), 'utf8');
    const latestMigration = '20260828150000_two_check_lifetime_free_trial.sql';

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
});
