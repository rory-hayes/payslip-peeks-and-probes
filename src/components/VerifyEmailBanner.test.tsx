import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerifyEmailBanner from './VerifyEmailBanner';

const mocks = vi.hoisted(() => ({
  resend: vi.fn(),
  toast: vi.fn(),
  user: {
    id: 'user-1',
    email: 'rory@example.com',
    email_confirmed_at: null,
    app_metadata: { provider: 'email' },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { resend: mocks.resend } },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

describe('VerifyEmailBanner', () => {
  beforeEach(() => {
    mocks.resend.mockReset();
    mocks.toast.mockReset();
  });

  it('restores the resend action after a provider transport failure', async () => {
    mocks.resend.mockRejectedValue(new Error('network unavailable'));
    render(<VerifyEmailBanner />);

    fireEvent.click(await screen.findByRole('button', { name: 'Resend email' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Could not resend',
      description: 'We could not resend the verification email. Please try again.',
      variant: 'destructive',
    }));
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
  });
});
