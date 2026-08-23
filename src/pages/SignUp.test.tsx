import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignUp from '@/pages/SignUp';

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
  toast: vi.fn(),
  googleOAuthEnabled: false,
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => state.navigate,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signUp: state.signUp, signInWithGoogle: state.signInWithGoogle }),
}));

vi.mock('@/lib/oauth-config', () => ({
  isGoogleOAuthEnabled: () => state.googleOAuthEnabled,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: state.toast }),
}));

function renderPage(initialEntry = '/sign-up') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SignUp />
    </MemoryRouter>,
  );
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Alex' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('SignUp', () => {
  beforeEach(() => {
    state.navigate.mockReset();
    state.signUp.mockReset();
    state.signInWithGoogle.mockReset();
    state.toast.mockReset();
    state.googleOAuthEnabled = false;
  });

  it('keeps a user on a clear confirmation state when email verification is required', async () => {
    state.signUp.mockResolvedValue({ error: null, emailConfirmationRequired: true });
    renderPage();
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    });
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('takes an immediately authenticated user to onboarding', async () => {
    state.signUp.mockResolvedValue({ error: null, emailConfirmationRequired: false });
    renderPage();
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(state.navigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('preserves an allowlisted paid plan through email sign-up and account setup', async () => {
    state.signUp.mockResolvedValue({ error: null, emailConfirmationRequired: false });
    renderPage('/sign-up?checkout=plus_yearly');
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(state.signUp).toHaveBeenCalledWith('alex@example.com', 'password123', 'Alex', 'plus_yearly');
      expect(state.navigate).toHaveBeenCalledWith('/onboarding?checkout=plus_yearly');
    });
  });

  it('shows the exact chosen plan before account creation and lets a visitor change it', () => {
    renderPage('/sign-up?checkout=plus_monthly_gbp');

    expect(screen.getByRole('complementary', { name: 'Selected paid plan' })).toHaveTextContent('Plus · £2.99 / month');
    expect(screen.getByRole('complementary', { name: 'Selected paid plan' })).toHaveTextContent('Billed monthly until you cancel.');
    expect(screen.getByRole('link', { name: 'Change plan' })).toHaveAttribute('href', '/pricing?currency=GBP&billing=monthly');
  });

  it('keeps a valid paid choice available after email confirmation', async () => {
    state.signUp.mockResolvedValue({ error: null, emailConfirmationRequired: true });
    renderPage('/sign-up?checkout=plus_yearly');
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/sign-in?checkout=plus_yearly');
    expect(screen.getByRole('complementary', { name: 'Selected paid plan' })).toHaveTextContent('Plus · €19.99 / year');
  });

  it('does not present an unconfigured social sign-in route before account creation', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });

  it('provides a page-level account-creation heading inside the main landmark', () => {
    renderPage();

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Create your account' }));
  });

  it('requires Terms and Privacy acknowledgement before starting Google sign-up', async () => {
    state.googleOAuthEnabled = true;
    state.signInWithGoogle.mockResolvedValue({ error: null });
    renderPage('/sign-up?checkout=plus_yearly');

    const googleButton = screen.getByRole('button', { name: 'Continue with Google' });
    expect(googleButton).toBeDisabled();
    expect(googleButton).toHaveAttribute('aria-describedby', 'terms-help');

    fireEvent.click(googleButton);
    expect(state.signInWithGoogle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(googleButton).toBeEnabled();

    fireEvent.click(googleButton);
    await waitFor(() => {
      expect(state.signInWithGoogle).toHaveBeenCalledWith(`${window.location.origin}/onboarding?checkout=plus_yearly`);
    });
  });

  it('restores account creation after a transport failure instead of leaving it loading', async () => {
    state.signUp.mockRejectedValue(new Error('network unavailable'));
    renderPage();
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(state.toast).toHaveBeenCalledWith({
      title: 'Sign up failed',
      description: 'We could not create your account. Please try again.',
      variant: 'destructive',
    }));
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
    expect(state.navigate).not.toHaveBeenCalled();
  });
});
