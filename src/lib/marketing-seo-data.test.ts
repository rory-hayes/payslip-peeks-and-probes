import { describe, expect, it } from 'vitest';
import {
  INDEXABLE_MARKETING_PAGES,
  buildMarketingJsonLd,
  marketingSeoFor,
} from './marketing-seo-data';

describe('marketing SEO data', () => {
  it('keeps the public route whitelist unique and returns matching runtime metadata', () => {
    const paths = INDEXABLE_MARKETING_PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);

    for (const page of INDEXABLE_MARKETING_PAGES) {
      expect(marketingSeoFor(page.path)).toEqual({
        title: page.title,
        description: page.description,
        canonicalPath: page.path,
        jsonLd: buildMarketingJsonLd(page),
      });
    }
  });

  it('puts the matching public URL in every structured-data payload', () => {
    for (const page of INDEXABLE_MARKETING_PAGES) {
      expect(buildMarketingJsonLd(page)).toMatchObject({
        '@context': 'https://schema.org',
        url: `https://payslipinsights.com${page.path}`,
      });
    }
  });

  it('fails closed when a non-indexable route asks for marketing metadata', () => {
    expect(() => marketingSeoFor('/dashboard')).toThrow(/No indexable marketing SEO metadata/);
  });
});
