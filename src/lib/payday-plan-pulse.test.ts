import { describe, expect, it } from 'vitest';
import { getPaydayPlanPulseState, paydayPlanPulseCadenceDays } from './payday-plan-pulse';

describe('payday plan pulse', () => {
  const now = new Date('2026-08-10T12:00:00Z');

  it('uses a shorter cadence for a weekly pay rhythm', () => {
    expect(paydayPlanPulseCadenceDays('weekly')).toBe(3);
    expect(paydayPlanPulseCadenceDays('fortnightly')).toBe(7);
  });

  it('prompts for the first manual check-in only while the plan still has time left', () => {
    expect(getPaydayPlanPulseState({
      daysUntilNextPayday: 5,
      everydayCheckedInAt: null,
      everydayRemaining: null,
      everydaySpending: 250,
      now,
    })).toEqual({ cadenceDays: 7, kind: 'first-check-in', lastCheckedInAt: null });

    expect(getPaydayPlanPulseState({
      daysUntilNextPayday: 0,
      everydayCheckedInAt: null,
      everydayRemaining: null,
      everydaySpending: 250,
      now,
    })).toBeNull();
  });

  it('waits for the right cadence before resurfacing a saved check-in', () => {
    expect(getPaydayPlanPulseState({
      daysUntilNextPayday: 12,
      everydayCheckedInAt: '2026-08-07T12:00:00Z',
      everydayRemaining: 140,
      everydaySpending: 250,
      now,
      payFrequency: 'weekly',
    })).toEqual({ cadenceDays: 3, kind: 'check-in-due', lastCheckedInAt: '2026-08-07T12:00:00Z' });

    expect(getPaydayPlanPulseState({
      daysUntilNextPayday: 12,
      everydayCheckedInAt: '2026-08-07T12:00:00Z',
      everydayRemaining: 140,
      everydaySpending: 250,
      now,
      payFrequency: 'monthly',
    })).toEqual({ cadenceDays: 7, kind: 'current-check-in', lastCheckedInAt: '2026-08-07T12:00:00Z' });
  });

  it('treats a partial or impossible saved check-in as a fresh manual prompt', () => {
    expect(getPaydayPlanPulseState({
      daysUntilNextPayday: 12,
      everydayCheckedInAt: '2026-08-09T12:00:00Z',
      everydayRemaining: null,
      everydaySpending: 250,
      now,
    })).toEqual({ cadenceDays: 7, kind: 'first-check-in', lastCheckedInAt: null });

    expect(getPaydayPlanPulseState({
      daysUntilNextPayday: 12,
      everydayCheckedInAt: '2026-08-09T12:00:00Z',
      everydayRemaining: 251,
      everydaySpending: 250,
      now,
    })).toEqual({ cadenceDays: 7, kind: 'first-check-in', lastCheckedInAt: null });
  });
});
