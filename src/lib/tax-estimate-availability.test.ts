import { describe, expect, it } from 'vitest';
import { getTaxEstimateAvailability } from './tax-estimate-availability';

describe('getTaxEstimateAvailability', () => {
  it('fails closed even for a historical UK payslip until a versioned payroll model is released', () => {
    const result = getTaxEstimateAvailability('UK', '2025-04-05');

    expect(result.available).toBe(false);
    expect(result.supportedPeriod).toBe('2024/25 UK');
  });

  it('does not expose the historical Ireland calculation as a current estimate', () => {
    const result = getTaxEstimateAvailability('Ireland', '2024-12-31');

    expect(result.available).toBe(false);
    expect(result.supportedPeriod).toBe('2024 Ireland');
  });

  it('fails closed for the public calculator after the tax table expires', () => {
    const result = getTaxEstimateAvailability('UK', null, new Date('2026-08-04T12:00:00Z'));

    expect(result.available).toBe(false);
    expect(result.supportedPeriod).toBe('2024/25 UK');
  });
});
