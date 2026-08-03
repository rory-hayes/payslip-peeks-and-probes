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

export type {
  CountryCode,
  CountryConfig,
  CurrencyCode,
  DeductionLine,
  SubRegion,
  FilingStatusOption,
} from './types';

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

/**
 * Countries available in the current public launch. Keep COUNTRY_LIST intact
 * so the country implementations can be completed and enabled deliberately.
 */
export const LAUNCH_COUNTRY_CODES = ['UK', 'Ireland'] as const;
export type LaunchCountryCode = (typeof LAUNCH_COUNTRY_CODES)[number];
export type LaunchCountryConfig = CountryConfig & { code: LaunchCountryCode };

export const LAUNCH_COUNTRY_LIST: readonly LaunchCountryConfig[] = LAUNCH_COUNTRY_CODES.map((code) => ({
  ...COUNTRIES[code],
  code,
}));

export function isLaunchCountry(
  code: CountryCode | null | undefined,
): code is LaunchCountryCode {
  return code === 'UK' || code === 'Ireland';
}

export function getCountryConfig(code: CountryCode | null | undefined): CountryConfig {
  if (code && COUNTRIES[code]) return COUNTRIES[code];
  return ukConfig;
}
