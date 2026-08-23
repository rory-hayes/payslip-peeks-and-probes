import type { Payslip } from '../types/models';

/**
 * A small, deliberately bounded status check for an already-created
 * processing payslip. These values govern client-side reads only: they must
 * never be used to dispatch or retry document processing.
 */
export const PENDING_PAYSLIP_STATUS_REFRESH_INTERVAL_MS = 8_000;
export const MAX_PENDING_PAYSLIP_STATUS_REFRESHES = 3;

type PendingPayslipStatus = Pick<Payslip, 'id' | 'status'>;

export function processingPayslipKey(payslips: readonly PendingPayslipStatus[]): string {
  return payslips
    .filter((payslip) => payslip.status === 'processing')
    .map((payslip) => payslip.id)
    .sort()
    .join('|');
}

export function shouldResetProcessingStatusRefreshes(previousKey: string, nextKey: string): boolean {
  return previousKey !== nextKey;
}

export function canAutoRefreshProcessingStatus({
  appState,
  processingKey,
  automaticAttempts,
  refreshInFlight,
}: {
  appState: string | null;
  processingKey: string;
  automaticAttempts: number;
  refreshInFlight: boolean;
}): boolean {
  return appState === 'active'
    && processingKey.length > 0
    && automaticAttempts < MAX_PENDING_PAYSLIP_STATUS_REFRESHES
    && !refreshInFlight;
}
