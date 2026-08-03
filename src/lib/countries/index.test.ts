import { describe, expect, it } from 'vitest';
import {
  LAUNCH_COUNTRY_LIST,
  isLaunchCountry,
} from './index';
import { FUTURE_GUIDE_PATHS, GUIDES_SEO } from '../guide-seo-data';

describe('UK and Ireland launch scope', () => {
  it('exposes only UK and Ireland through the public country list', () => {
    expect(LAUNCH_COUNTRY_LIST.map((country) => country.code)).toEqual(['UK', 'Ireland']);
    expect(isLaunchCountry('UK')).toBe(true);
    expect(isLaunchCountry('Ireland')).toBe(true);
    expect(isLaunchCountry('Germany')).toBe(false);
    expect(isLaunchCountry(null)).toBe(false);
  });

  it('does not pre-render future country guides for search engines', () => {
    const indexedPaths = new Set(GUIDES_SEO.map((guide) => guide.path));

    for (const path of FUTURE_GUIDE_PATHS) {
      expect(indexedPaths.has(path)).toBe(false);
    }
  });
});
