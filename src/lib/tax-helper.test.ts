import { describe, expect, it } from 'vitest';
import { isDateInTaxYear, taxYearWindow } from './tax-helper';

describe('tax year helper', () => {
  it('uses a calendar year for Ireland', () => {
    const window = taxYearWindow('Ireland', new Date('2026-08-28T12:00:00Z'));
    expect(window.label).toBe('2026');
    expect(isDateInTaxYear('2026-01-01', window)).toBe(true);
    expect(isDateInTaxYear('2025-12-31', window)).toBe(false);
  });

  it('uses the 6 April boundary for the UK', () => {
    const current = taxYearWindow('UK', new Date('2026-08-28T12:00:00Z'));
    expect(current.label).toBe('2026/27');
    expect(isDateInTaxYear('2026-04-06', current)).toBe(true);
    expect(isDateInTaxYear('2026-04-05', current)).toBe(false);

    const previous = taxYearWindow('UK', new Date('2026-02-01T12:00:00Z'));
    expect(previous.label).toBe('2025/26');
  });

  it('can select the last completed tax year', () => {
    expect(taxYearWindow('Ireland', new Date('2026-08-28T12:00:00Z'), -1).label).toBe('2025');
    const uk = taxYearWindow('UK', new Date('2026-08-28T12:00:00Z'), -1);
    expect(uk.label).toBe('2025/26');
    expect(isDateInTaxYear('2026-03-31', uk)).toBe(true);
  });

  it('rejects missing and invalid dates', () => {
    const window = taxYearWindow('Ireland', new Date('2026-08-28T12:00:00Z'));
    expect(isDateInTaxYear(null, window)).toBe(false);
    expect(isDateInTaxYear('not-a-date', window)).toBe(false);
  });
});
