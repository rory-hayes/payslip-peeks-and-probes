import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Landing from './Landing';

const state = vi.hoisted(() => ({
  enableDemo: vi.fn(),
  loading: false,
  user: null as { id: string } | null,
}));

vi.mock('@/contexts/DemoContext', () => ({
  useDemo: () => ({ enableDemo: state.enableDemo }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ loading: state.loading, user: state.user }),
}));

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Landing />
      <Location />
    </MemoryRouter>,
  );
}

describe('Landing', () => {
  beforeEach(() => {
    state.enableDemo.mockReset();
    state.loading = false;
    state.user = null;
  });

  it('keeps the selected consumer journey wired to sign-up, demo, and anchored sections', () => {
    renderLanding();

    expect(screen.getByRole('link', { name: /check a payslip/i })).toHaveAttribute('href', '/sign-up');
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how-it-works');
    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features');
    expect(screen.getAllByRole('link', { name: 'Pricing' }).find((link) => link.getAttribute('href') === '#pricing')).toBeDefined();
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq');

    fireEvent.click(screen.getByRole('button', { name: /try the demo/i }));

    expect(state.enableDemo).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });

  it('sends a signed-in visitor to their dashboard instead of showing a public upload route', async () => {
    state.user = { id: 'user-1' };
    renderLanding();

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
  });
});
