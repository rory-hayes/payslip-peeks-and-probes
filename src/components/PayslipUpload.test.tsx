import { describe, expect, it } from 'vitest';

import { isOwnedPayslipObjectPath, parseIssuedPayslipUpload, sanitizePayslipDisplayFileName } from '@/lib/payslip-upload';

describe('payslip storage paths', () => {
  it('reduces a user-controlled filename to one safe storage segment', () => {
    expect(sanitizePayslipDisplayFileName('../../Payroll\\April payslip (final).pdf'))
      .toBe('April-payslip-final.pdf');
    expect(sanitizePayslipDisplayFileName('..\\..\\..')).toBe('payslip');
  });

  it('only accepts a server-issued single object segment beneath the signed-in user prefix', () => {
    const userId = '00000000-0000-4000-8000-000000000001';

    expect(isOwnedPayslipObjectPath(userId, `${userId}/safe-payslip.bin`)).toBe(true);
    expect(isOwnedPayslipObjectPath(userId, `${userId}/nested/safe-payslip.bin`)).toBe(false);
    expect(isOwnedPayslipObjectPath(userId, `another-user/safe-payslip.bin`)).toBe(false);
  });

  it('rejects a malformed signed-upload response before bytes are sent', () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    expect(parseIssuedPayslipUpload({
      sessionId: '00000000-0000-4000-8000-000000000002',
      path: 'another-user/not-owned.bin',
      token: 'a-valid-temporary-token',
      contentType: 'application/pdf',
      expiresAt: '2026-08-04T12:00:00.000Z',
    }, userId)).toBeNull();
  });
});
