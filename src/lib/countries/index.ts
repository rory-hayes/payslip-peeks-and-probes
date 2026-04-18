import type { CountryCode, CountryConfig } from './types';
import { ukConfig } from './uk';
import { irelandConfig } from './ireland';
import { germanyConfig } from './germany';

export type { CountryCode, CountryConfig, CurrencyCode, DeductionLine } from './types';

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  UK: ukConfig,
  Ireland: irelandConfig,
  Germany: germanyConfig,
};

export const COUNTRY_LIST: CountryConfig[] = [ukConfig, irelandConfig, germanyConfig];

export function getCountryConfig(code: CountryCode | null | undefined): CountryConfig {
  if (code && COUNTRIES[code]) return COUNTRIES[code];
  return ukConfig;
}
