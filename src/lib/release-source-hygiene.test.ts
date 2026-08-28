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
});
