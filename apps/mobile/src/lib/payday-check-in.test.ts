import { describe, expect, it } from 'vitest';
import { validatePaydayCheckIn } from './payday-check-in';

describe('validatePaydayCheckIn', () => {
  const activePlan = '1ea3d08e-a1ea-438f-a8d5-8d75c4c8bef8';

  it('accepts a manual amount within the everyday-spending amount in the active plan', () => {
    expect(validatePaydayCheckIn({
      planId: activePlan,
      plannedEveryday: 300,
      everydayRemaining: 125.5,
    })).toEqual({ ok: true, everydayRemaining: 125.5 });
  });

  it.each([
    { planId: null, plannedEveryday: 300, everydayRemaining: 10 },
    { planId: activePlan, plannedEveryday: 0, everydayRemaining: 10 },
    { planId: activePlan, plannedEveryday: 300, everydayRemaining: null },
    { planId: activePlan, plannedEveryday: 300, everydayRemaining: -1 },
    { planId: activePlan, plannedEveryday: 300, everydayRemaining: 300.01 },
  ])('rejects an unsafe client submission: %o', (input) => {
    expect(validatePaydayCheckIn(input)).toMatchObject({ ok: false });
  });
});
