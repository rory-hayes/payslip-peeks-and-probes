import { describe, expect, it } from 'vitest';
import { normalizePayslipStatus } from './use-payslip-data';

describe('normalizePayslipStatus', () => {
  it('maps only a completed server lifecycle state to a confirmed client record', () => {
    expect(normalizePayslipStatus('completed')).toBe('confirmed');
    expect(normalizePayslipStatus('needs_review')).toBe('extracted');
    expect(normalizePayslipStatus('processing')).toBe('processing');
    expect(normalizePayslipStatus('unknown')).toBe('processing');
  });
});
