import { describe, expect, it } from 'vitest';
import {
  automaticCheckLimit,
  dublinMonthPeriod,
  FREE_AUTOMATIC_CHECKS_LIFETIME,
  PAID_DRAFTS_PER_MONTH,
  PAID_UPLOADS_PER_MONTH,
  payrollMessageDraftLimit,
} from './use-usage';

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

  it('keeps the paid upload allowance finite in the browser pre-flight', () => {
    expect(automaticCheckLimit(false, FREE_AUTOMATIC_CHECKS_LIFETIME)).toBe(2);
    expect(automaticCheckLimit(true, FREE_AUTOMATIC_CHECKS_LIFETIME)).toBe(PAID_UPLOADS_PER_MONTH);
    expect(FREE_AUTOMATIC_CHECKS_LIFETIME).toBe(2);
    expect(PAID_UPLOADS_PER_MONTH).toBe(6);
  });

  it('keeps the paid payroll-message allowance finite in the browser pre-flight', () => {
    expect(payrollMessageDraftLimit(false, 2)).toBe(2);
    expect(payrollMessageDraftLimit(true, 2)).toBe(PAID_DRAFTS_PER_MONTH);
    expect(PAID_DRAFTS_PER_MONTH).toBe(12);
  });
});
