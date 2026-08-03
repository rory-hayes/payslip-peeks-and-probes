import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { createPayslipStoragePath, sanitizeStorageFilename } from './PayslipUpload';

describe('payslip storage paths', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reduces a user-controlled filename to one safe storage segment', () => {
    expect(sanitizeStorageFilename('../../Payroll\\April payslip (final).pdf'))
      .toBe('April-payslip-final.pdf');
    expect(sanitizeStorageFilename('..\\..\\..')).toBe('payslip');
  });

  it('keeps each upload within the authenticated user prefix', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('123e4567-e89b-12d3-a456-426614174000');

    expect(createPayslipStoragePath(
      '00000000-0000-4000-8000-000000000001',
      '../another-user/April payslip.pdf',
    )).toBe('00000000-0000-4000-8000-000000000001/123e4567-e89b-12d3-a456-426614174000-April-payslip.pdf');
  });

  it('refuses a user prefix that could create a nested storage path', () => {
    expect(() => createPayslipStoragePath('../another-user', 'payslip.pdf'))
      .toThrow('Unable to create a secure storage path');
  });
});
