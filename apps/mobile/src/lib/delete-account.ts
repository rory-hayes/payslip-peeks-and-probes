import { supabase } from './supabase';

type AccountDeletionBlockCode =
  | 'checkout_pending'
  | 'billing_needs_review'
  | 'payslip_cleanup_needs_review'
  | 'upload_token_pending';

type AccountDeletionPendingCode = 'account_deletion_pending';

/**
 * A deletion can complete while a late payment still needs a separate,
 * support-led reconciliation. This is deliberately a terminal deletion
 * outcome: the account data is gone and the device must sign out.
 */
export type AccountDeletionResult = {
  billingFollowUpRequired: boolean;
};

const SAFE_BLOCK_MESSAGES: Record<AccountDeletionBlockCode, string> = {
  checkout_pending: 'A payment is still being confirmed. Please wait a moment and try again.',
  billing_needs_review: 'A checkout needs a billing review before this account can be deleted. Please contact support.',
  payslip_cleanup_needs_review: 'We need to safely confirm removal of a stored payslip before deleting this account. Please contact support.',
  upload_token_pending: 'A recent secure upload is still protected by a short upload window. Please try deleting this account again shortly.',
};

export class AccountDeletionBlockedError extends Error {
  constructor(readonly code: AccountDeletionBlockCode) {
    super(SAFE_BLOCK_MESSAGES[code]);
    this.name = 'AccountDeletionBlockedError';
  }
}

export class AccountDeletionPendingError extends Error {
  constructor(readonly code: AccountDeletionPendingCode) {
    super('Your account deletion is safely queued and will continue automatically. You can close the app while it finishes.');
    this.name = 'AccountDeletionPendingError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeBlockedError(value: unknown): AccountDeletionBlockedError | null {
  if (!isRecord(value) || typeof value.code !== 'string' || !(value.code in SAFE_BLOCK_MESSAGES)) return null;
  return new AccountDeletionBlockedError(value.code as AccountDeletionBlockCode);
}

function safePendingError(value: unknown): AccountDeletionPendingError | null {
  if (!isRecord(value) || value.code !== 'account_deletion_pending') return null;
  return new AccountDeletionPendingError('account_deletion_pending');
}

function confirmedDeletion(value: unknown): AccountDeletionResult | null {
  if (!isRecord(value) || value.success !== true) return null;

  return {
    billingFollowUpRequired: value.billingReviewRequired === true && value.code === 'billing_needs_review',
  };
}

async function functionErrorPayload(error: unknown): Promise<unknown> {
  if (!isRecord(error)) return null;
  const context = error.context;
  if (isRecord(context) && typeof context.json === 'function') {
    try {
      return await (context.json as () => Promise<unknown>)();
    } catch {
      return null;
    }
  }
  return isRecord(context) ? context : null;
}

export async function deleteCurrentAccount(): Promise<AccountDeletionResult> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });

  // A completed deletion with a billing follow-up deliberately carries the
  // same safe code as a pre-deletion billing block. The explicit success
  // contract must win: leaving the device signed in or telling someone to
  // retry would be false once the server has removed their account data.
  const deletion = confirmedDeletion(data);
  if (deletion) return deletion;

  const blockedByData = safeBlockedError(data);
  if (blockedByData) throw blockedByData;
  const pendingByData = safePendingError(data);
  if (pendingByData) throw pendingByData;

  if (error) {
    const errorPayload = await functionErrorPayload(error);
    const blockedByError = safeBlockedError(errorPayload);
    if (blockedByError) throw blockedByError;
    const pendingByError = safePendingError(errorPayload);
    if (pendingByError) throw pendingByError;
    throw new Error('Account deletion could not be completed.');
  }

  throw new Error('Account deletion was not confirmed by the server.');
}
