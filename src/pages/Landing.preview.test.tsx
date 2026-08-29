import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import Landing from './Landing';

const state = vi.hoisted(() => ({
  enableDemo: vi.fn(),
  getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}));

vi.mock('@/lib/public-legal-details', () => ({
  acceptsRealPayslips: false,
}));

vi.mock('@/contexts/DemoContext', () => ({
  useDemo: () => ({ enableDemo: state.enableDemo }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: state.getSession,
      onAuthStateChange: state.onAuthStateChange,
    },
  },
}));

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

describe('Landing production preview gate', () => {
  it('replaces real-account calls to action with the working sample', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Landing />
        <Location />
      </MemoryRouter>,
    );

    expect(screen.getByText(/early-access preview · real uploads and new accounts are not open yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /check a payslip/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Choose Plus' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Plus details' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('heading', { name: 'Ready to see the full journey?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Explore the live demo' }));

    expect(state.enableDemo).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });
});
