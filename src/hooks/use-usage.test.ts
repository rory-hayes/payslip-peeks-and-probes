import { describe, expect, it } from 'vitest';
import { dublinMonthPeriod } from './use-usage';

describe('dublinMonthPeriod', () => {
  it('uses the Europe/Dublin calendar month across the summer-time boundary', () => {
    expect(dublinMonthPeriod('2026-03-31T23:30:00.000Z')).toBe('2026-04-01');
  });

  it('uses the Europe/Dublin calendar month at the year boundary', () => {
    expect(dublinMonthPeriod('2027-01-01T00:30:00.000Z')).toBe('2027-01-01');
  });

  it('rejects malformed dates instead of silently counting them in a free allowance', () => {
    expect(() => dublinMonthPeriod('not-a-date')).toThrow('Invalid date for monthly usage');
  });
});
