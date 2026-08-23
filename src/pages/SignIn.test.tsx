import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignIn from '@/pages/SignIn';

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  signIn: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => state.navigate,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signIn: state.signIn, signInWithGoogle: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: state.toast }),
}));

function renderPage(initialEntry = '/sign-in') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SignIn />
    </MemoryRouter>,
  );
}

describe('SignIn', () => {
  beforeEach(() => {
    state.navigate.mockReset();
    state.signIn.mockReset();
    state.toast.mockReset();
  });

  it('takes a returning paid visitor back to their selected checkout after sign-in', async () => {
    state.signIn.mockResolvedValue({ error: null });
    renderPage('/sign-in?checkout=plus_yearly');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(state.navigate).toHaveBeenCalledWith('/checkout?price=plus_yearly');
    });
  });

  it('takes a returning paid visitor back to their exact checkout return after sign-in', async () => {
    state.signIn.mockResolvedValue({ error: null });
    renderPage('/sign-in?checkout_return=cs_test_checkoutreturn123');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(state.navigate).toHaveBeenCalledWith('/checkout/return?session_id=cs_test_checkoutreturn123');
    });
  });

  it('keeps an allowlisted paid plan if a returning visitor needs to create an account instead', () => {
    renderPage('/sign-in?checkout=plus_yearly');

    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/sign-up?checkout=plus_yearly');
  });

  it('shows a returning visitor the exact paid choice before sign-in', () => {
    renderPage('/sign-in?checkout=lifetime_once_gbp');

    expect(screen.getByRole('complementary', { name: 'Selected paid plan' })).toHaveTextContent('Lifetime · £29.99 once');
    expect(screen.getByRole('complementary', { name: 'Selected paid plan' })).toHaveTextContent('One payment. It does not renew.');
    expect(screen.getByRole('link', { name: 'Change plan' })).toHaveAttribute('href', '/pricing?currency=GBP');
  });

  it('does not present an unconfigured social sign-in route beside the verified email flow', () => {
    renderPage();

    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });

  it('uses password-manager friendly email and password autocomplete fields', () => {
    renderPage();

    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('provides a page-level sign-in heading inside the main landmark', () => {
    renderPage();

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Welcome back' }));
  });

  it('restores the email form after a transport failure instead of leaving it loading', async () => {
    state.signIn.mockRejectedValue(new Error('network unavailable'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(state.toast).toHaveBeenCalledWith({
      title: 'Sign in failed',
      description: 'We could not sign you in. Please try again.',
      variant: 'destructive',
    }));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(state.navigate).not.toHaveBeenCalled();
  });
});
