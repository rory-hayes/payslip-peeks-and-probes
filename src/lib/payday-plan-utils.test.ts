import { describe, expect, it } from 'vitest';
import { calendarDaysUntilIsoDate, everydaySpendingGuide, inferNextPayday } from './payday-plan-utils';
import type { Payslip } from './types';

const latestPayslip = {
  id: 'latest',
  pay_date: '2026-08-01',
  status: 'confirmed',
} as Payslip;

describe('calendarDaysUntilIsoDate', () => {
  it('counts whole calendar days without treating today as overdue', () => {
    expect(calendarDaysUntilIsoDate('2026-08-03', '2026-08-03')).toBe(0);
    expect(calendarDaysUntilIsoDate('2026-08-04', '2026-08-03')).toBe(1);
    expect(calendarDaysUntilIsoDate('2026-08-17', '2026-08-03')).toBe(14);
  });

  it('keeps a past or malformed payday distinguishable from a future one', () => {
    expect(calendarDaysUntilIsoDate('2026-08-02', '2026-08-03')).toBe(-1);
    expect(calendarDaysUntilIsoDate('not-a-date', '2026-08-03')).toBeNull();
    expect(calendarDaysUntilIsoDate('2026-08-17', 'not-a-date')).toBeNull();
  });
});

describe('everydaySpendingGuide', () => {
  it('uses calendar days remaining rather than a 24-hour duration', () => {
    expect(everydaySpendingGuide(350, '2026-08-17', '2026-08-03')).toBe(25);
  });

  it('does not turn a past, current, malformed, or negative amount into a guide', () => {
    expect(everydaySpendingGuide(350, '2026-08-03', '2026-08-03')).toBeNull();
    expect(everydaySpendingGuide(350, '2026-08-02', '2026-08-03')).toBeNull();
    expect(everydaySpendingGuide(350, 'not-a-date', '2026-08-03')).toBeNull();
    expect(everydaySpendingGuide(-1, '2026-08-17', '2026-08-03')).toBeNull();
  });
});

describe('inferNextPayday', () => {
  it('uses a saved weekly or fortnightly pay rhythm for a first confirmed payslip', () => {
    expect(inferNextPayday(latestPayslip, [latestPayslip], '2026-08-03', 'weekly')).toBe('2026-08-08');
    expect(inferNextPayday(latestPayslip, [latestPayslip], '2026-08-03', 'fortnightly')).toBe('2026-08-15');
  });

  it('keeps actual payslip history ahead of a profile fallback', () => {
    const previous = { ...latestPayslip, id: 'previous', pay_date: '2026-07-01' };
    expect(inferNextPayday(latestPayslip, [previous, latestPayslip], '2026-08-03', 'weekly')).toBe('2026-09-01');
  });
});
