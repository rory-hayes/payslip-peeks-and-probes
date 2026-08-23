import { describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke } },
}));

import { deleteCurrentAccount } from './delete-account';

describe('deleteCurrentAccount', () => {
  it('shows only the safe wait message when a signed upload token has not expired', async () => {
    invoke.mockResolvedValueOnce({
      data: { code: 'upload_token_pending' },
      error: null,
    });

    await expect(deleteCurrentAccount()).rejects.toEqual(expect.objectContaining({
      code: 'upload_token_pending',
      message: 'A recent secure upload is still protected by a short upload window. Please try deleting this account again shortly.',
    }));
  });

  it('does not pass provider diagnostics through the customer flow', async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'private storage provider diagnostic' },
    });

    await expect(deleteCurrentAccount()).rejects.toThrow('Account deletion could not be completed.');
  });

  it('does not treat a queued durable deletion as already complete', async () => {
    invoke.mockResolvedValueOnce({
      data: { pending: true, code: 'account_deletion_pending' },
      error: null,
    });

    await expect(deleteCurrentAccount()).rejects.toEqual(expect.objectContaining({
      code: 'account_deletion_pending',
      message: 'Your account deletion is safely queued and will continue automatically. You can close the app while it finishes.',
    }));
  });

  it('treats a completed deletion with a billing follow-up as terminal', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        success: true,
        billingReviewRequired: true,
        code: 'billing_needs_review',
      },
      error: null,
    });

    await expect(deleteCurrentAccount()).resolves.toEqual({ billingFollowUpRequired: true });
  });

  it('keeps an ordinary confirmed deletion distinct from a billing follow-up', async () => {
    invoke.mockResolvedValueOnce({ data: { success: true }, error: null });

    await expect(deleteCurrentAccount()).resolves.toEqual({ billingFollowUpRequired: false });
  });
});
