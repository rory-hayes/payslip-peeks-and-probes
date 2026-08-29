import type { CountryCode, CountryConfig } from './types';
import { ukConfig } from './uk';
import { irelandConfig } from './ireland';

export type {
  CountryCode,
  CountryConfig,
  CurrencyCode,
  DeductionLine,
  SubRegion,
  FilingStatusOption,
} from './types';

/**
 * Countries available in the current public launch. Future country source
 * files stay in the repository, but are intentionally not imported here: a
 * dormant calculator must not increase the download for UK/Ireland customers.
 */
export const LAUNCH_COUNTRY_CODES = ['Ireland', 'UK'] as const;
export type LaunchCountryCode = (typeof LAUNCH_COUNTRY_CODES)[number];
export type LaunchCountryConfig = CountryConfig & { code: LaunchCountryCode };

export const DEFAULT_LAUNCH_COUNTRY_CODE: LaunchCountryCode = 'Ireland';

export const COUNTRIES: Record<LaunchCountryCode, LaunchCountryConfig> = {
  UK: { ...ukConfig, code: 'UK' },
  Ireland: { ...irelandConfig, code: 'Ireland' },
};

export const COUNTRY_LIST: readonly LaunchCountryConfig[] = [COUNTRIES.Ireland, COUNTRIES.UK];
export const LAUNCH_COUNTRY_LIST = COUNTRY_LIST;

export function isLaunchCountry(
  code: CountryCode | null | undefined,
): code is LaunchCountryCode {
  return code === 'UK' || code === 'Ireland';
}

export function getCountryConfig(code: CountryCode | null | undefined): CountryConfig {
  if (isLaunchCountry(code)) return COUNTRIES[code];
  return COUNTRIES[DEFAULT_LAUNCH_COUNTRY_CODE];
}
