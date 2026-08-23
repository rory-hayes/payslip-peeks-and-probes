import { describe, expect, it } from 'vitest';
import {
  canAutoRefreshProcessingStatus,
  MAX_PENDING_PAYSLIP_STATUS_REFRESHES,
  processingPayslipKey,
  shouldResetProcessingStatusRefreshes,
} from './pending-payslip-status-refresh';

describe('processingPayslipKey', () => {
  it('includes only live processing checks and stays stable when their order changes', () => {
    expect(processingPayslipKey([
      { id: 'review', status: 'needs_review' },
      { id: 'second', status: 'processing' },
      { id: 'failed', status: 'failed' },
      { id: 'first', status: 'processing' },
    ])).toBe('first|second');
  });

  it('resets the bounded refresh allowance only for a new processing set', () => {
    expect(shouldResetProcessingStatusRefreshes('first', 'first')).toBe(false);
    expect(shouldResetProcessingStatusRefreshes('first', 'second')).toBe(true);
    expect(shouldResetProcessingStatusRefreshes('first', '')).toBe(true);
  });
});

describe('canAutoRefreshProcessingStatus', () => {
  it('allows a bounded read while the app is foregrounded and processing remains', () => {
    expect(canAutoRefreshProcessingStatus({
      appState: 'active',
      processingKey: 'payslip-1',
      automaticAttempts: MAX_PENDING_PAYSLIP_STATUS_REFRESHES - 1,
      refreshInFlight: false,
    })).toBe(true);
  });

  it.each([
    { appState: 'background', processingKey: 'payslip-1', automaticAttempts: 0, refreshInFlight: false },
    { appState: 'inactive', processingKey: 'payslip-1', automaticAttempts: 0, refreshInFlight: false },
    { appState: 'active', processingKey: '', automaticAttempts: 0, refreshInFlight: false },
    { appState: 'active', processingKey: 'payslip-1', automaticAttempts: MAX_PENDING_PAYSLIP_STATUS_REFRESHES, refreshInFlight: false },
    { appState: 'active', processingKey: 'payslip-1', automaticAttempts: 0, refreshInFlight: true },
  ])('does not run outside the safe foreground-only window: %o', (input) => {
    expect(canAutoRefreshProcessingStatus(input)).toBe(false);
  });
});
