import { describe, expect, it } from 'vitest';
import {
  createRateLimitWindow,
  deniedRateLimitResult,
  resolveRateLimitResult,
} from '../../supabase/functions/_shared/rate-limit-contract';

describe('rate-limit contract', () => {
  it('uses a stable fixed window and retry duration', () => {
    const window = createRateLimitWindow(new Date('2026-08-04T14:30:45.500Z'), 3_600);

    expect(window).toMatchObject({
      retryAfterSeconds: 1_755,
      start: new Date('2026-08-04T14:00:00.000Z'),
    });
    expect(createRateLimitWindow(new Date('invalid'), 3_600)).toBeNull();
    expect(createRateLimitWindow(new Date(), 0)).toBeNull();
  });

  it('accepts the exact single-row RPC response and computes the remaining quota', () => {
    expect(resolveRateLimitResult([{ allowed: true, current_count: 8 }], 10, 1_755)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 2,
    });
    expect(resolveRateLimitResult({ allowed: false, current_count: 11 }, 10, 1_755)).toEqual({
      allowed: false,
      retryAfterSeconds: 1_755,
      remaining: 0,
    });
  });

  it('fails closed for malformed, ambiguous, or contradictory RPC results', () => {
    expect(resolveRateLimitResult([], 10, 60)).toBeNull();
    expect(resolveRateLimitResult([
      { allowed: true, current_count: 1 },
      { allowed: true, current_count: 2 },
    ], 10, 60)).toBeNull();
    expect(resolveRateLimitResult({ allowed: true, current_count: 1.5 }, 10, 60)).toBeNull();
    expect(resolveRateLimitResult({ allowed: true, current_count: 11 }, 10, 60)).toBeNull();
    expect(resolveRateLimitResult({ allowed: false, current_count: 10 }, 10, 60)).toBeNull();
    expect(resolveRateLimitResult({ allowed: true, current_count: 1 }, 0, 60)).toBeNull();
  });

  it('always provides a safe denial response when a counter cannot be trusted', () => {
    expect(deniedRateLimitResult()).toEqual({ allowed: false, retryAfterSeconds: 1, remaining: 0 });
    expect(deniedRateLimitResult(Number.NaN)).toEqual({ allowed: false, retryAfterSeconds: 1, remaining: 0 });
  });
});
