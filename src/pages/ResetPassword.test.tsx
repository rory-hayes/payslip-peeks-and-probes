import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPassword from '@/pages/ResetPassword';

const state = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => state.navigate,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: state.exchangeCodeForSession,
      getSession: state.getSession,
      updateUser: state.updateUser,
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: state.toast }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>,
  );
}

function recoverySession() {
  return { data: { session: { access_token: 'recovery-session' } }, error: null };
}

describe('ResetPassword', () => {
  beforeEach(() => {
    state.exchangeCodeForSession.mockReset();
    state.getSession.mockReset();
    state.navigate.mockReset();
    state.toast.mockReset();
    state.updateUser.mockReset();
    state.getSession.mockResolvedValue(recoverySession());
    state.exchangeCodeForSession.mockResolvedValue({ error: null });
    state.updateUser.mockResolvedValue({ error: null });
    window.history.replaceState({}, '', '/reset-password#access_token=token&type=recovery');
  });

  it('requires a real recovery session rather than trusting the recovery marker alone', async () => {
    state.getSession.mockResolvedValue({ data: { session: null }, error: null });

    renderPage();

    expect(await screen.findByRole('heading', { name: "This reset link can't be used" })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Set a new password' })).not.toBeInTheDocument();
  });

  it('exchanges a PKCE recovery code and removes credentials from the visible URL', async () => {
    window.history.replaceState({}, '', '/reset-password?code=recovery-code');

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeInTheDocument();
    expect(state.exchangeCodeForSession).toHaveBeenCalledWith('recovery-code');
    expect(window.location.pathname).toBe('/reset-password');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });

  it('requires two matching passwords before calling the provider', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Set a new password' });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Update password' }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent('Your passwords do not match.');
    expect(state.updateUser).not.toHaveBeenCalled();
  });

  it('updates a verified recovery session then sends the person to sign in', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Set a new password' });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(state.updateUser).toHaveBeenCalledWith({ password: 'password123' });
      expect(state.navigate).toHaveBeenCalledWith('/sign-in');
    });
  });

  it('does not leave a recovery session loading when the provider request rejects', async () => {
    state.updateUser.mockRejectedValue(new Error('network unavailable'));
    renderPage();

    await screen.findByRole('heading', { name: 'Set a new password' });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not update your password. Please try again.');
    expect(screen.getByRole('button', { name: 'Update password' })).toBeEnabled();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('shows an invalid-link state if establishing the recovery session throws', async () => {
    state.getSession.mockRejectedValue(new Error('network unavailable'));

    renderPage();

    expect(await screen.findByRole('heading', { name: "This reset link can't be used" })).toBeInTheDocument();
  });
});
