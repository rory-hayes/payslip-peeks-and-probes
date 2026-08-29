import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import SignUp from './SignUp';

const state = vi.hoisted(() => ({
  enableDemo: vi.fn(),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('@/lib/public-legal-details', () => ({
  acceptsRealPayslips: false,
}));

vi.mock('@/contexts/DemoContext', () => ({
  useDemo: () => ({ enableDemo: state.enableDemo }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signUp: state.signUp, signInWithGoogle: state.signInWithGoogle }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

describe('SignUp production preview gate', () => {
  it('collects no account details and opens the sample journey instead', () => {
    render(
      <MemoryRouter initialEntries={['/sign-up?checkout=plus_yearly']}>
        <SignUp />
        <Location />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Secure uploads are not open yet' })).toBeInTheDocument();
    expect(screen.getByText(/no personal details needed/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create free account' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to an existing account' })).toHaveAttribute('href', '/sign-in');

    fireEvent.click(screen.getByRole('button', { name: 'Explore the sample' }));

    expect(state.enableDemo).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
    expect(state.signUp).not.toHaveBeenCalled();
  });
});
