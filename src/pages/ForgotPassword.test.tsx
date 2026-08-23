import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPassword from '@/pages/ForgotPassword';

const state = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ resetPassword: state.resetPassword }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: state.toast }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>,
  );
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    state.resetPassword.mockReset();
    state.toast.mockReset();
  });

  it('restores the form after a transport failure instead of leaving it loading', async () => {
    state.resetPassword.mockRejectedValue(new Error('network unavailable'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => expect(state.toast).toHaveBeenCalledWith({
      title: 'Reset link unavailable',
      description: 'We could not send a reset link. Please try again.',
      variant: 'destructive',
    }));
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  });

  it('uses the email autocomplete hint for password recovery', () => {
    renderPage();

    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
  });

  it('provides a page-level password-recovery heading inside the main landmark', () => {
    renderPage();

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Reset your password' }));
  });
});
