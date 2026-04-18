import type { CountryCode, CountryConfig } from './types';
import { ukConfig } from './uk';
import { irelandConfig } from './ireland';
import { germanyConfig } from './germany';
import { franceConfig } from './france';
import { netherlandsConfig } from './netherlands';
import { spainConfig } from './spain';
import { italyConfig } from './italy';
import { belgiumConfig } from './belgium';
import { portugalConfig } from './portugal';
import { usConfig } from './us';

export type { CountryCode, CountryConfig, CurrencyCode, DeductionLine } from './types';

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  UK: ukConfig,
  Ireland: irelandConfig,
  Germany: germanyConfig,
  France: franceConfig,
  Netherlands: netherlandsConfig,
  Spain: spainConfig,
  Italy: italyConfig,
  Belgium: belgiumConfig,
  Portugal: portugalConfig,
  US: usConfig,
};

export const COUNTRY_LIST: CountryConfig[] = [
  ukConfig,
  irelandConfig,
  germanyConfig,
  franceConfig,
  netherlandsConfig,
  spainConfig,
  italyConfig,
  belgiumConfig,
  portugalConfig,
  usConfig,
];

export function getCountryConfig(code: CountryCode | null | undefined): CountryConfig {
  if (code && COUNTRIES[code]) return COUNTRIES[code];
  return ukConfig;
}
