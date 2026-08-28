import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Landing from './Landing';

const state = vi.hoisted(() => ({
  enableDemo: vi.fn(),
  session: null as { user: { id: string } } | null,
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}));

function createStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

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

const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

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
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createStorage(),
    });
    state.enableDemo.mockReset();
    state.session = null;
    state.getSession.mockReset();
    state.onAuthStateChange.mockReset();
    state.unsubscribe.mockReset();
    state.getSession.mockImplementation(() => Promise.resolve({ data: { session: state.session } }));
    state.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: state.unsubscribe } },
    });
  });

  it('keeps the selected consumer journey wired to sign-up, demo, and anchored sections', () => {
    renderLanding();

    expect(document.title).toBe('Payslip Insights — Understand and compare your pay');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe('Upload a payslip, confirm its figures, compare pay changes, prepare payroll questions, and follow official UK or Ireland tax-year steps.');
    expect(screen.getByRole('link', { name: /check a payslip/i })).toHaveAttribute('href', '/sign-up');
    expect(screen.getByRole('link', { name: 'Choose Plus' })).toHaveAttribute('href', '/sign-up?checkout=plus_yearly');
    expect(screen.getByText('Billed €19.99 yearly until you cancel.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how-it-works');
    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features');
    expect(screen.getByRole('link', { name: 'Explore payslip guides' })).toHaveAttribute('href', '/guides');
    expect(screen.getAllByRole('link', { name: 'Pricing' }).find((link) => link.getAttribute('href') === '#pricing')).toBeDefined();
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#faq');

    fireEvent.click(screen.getByRole('button', { name: /try the demo/i }));

    expect(state.enableDemo).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  }, 10_000);

  it('keeps UK prices and the selected GBP checkout intent together', () => {
    renderLanding();

    const pounds = screen.getByRole('button', { name: 'United Kingdom · GBP' });
    expect(pounds).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pounds);

    expect(pounds).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('£17.99')).toBeInTheDocument();
    expect(screen.getByText('Billed £17.99 yearly until you cancel.')).toBeInTheDocument();
    expect(screen.getByText('Prices are shown for United Kingdom in GBP.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose Plus' })).toHaveAttribute('href', '/sign-up?checkout=plus_yearly_gbp');
    expect(screen.getByRole('link', { name: /view full pricing comparison/i })).toHaveAttribute('href', '/pricing?currency=GBP');
  });

  it('keeps the complete marketing navigation available behind the mobile menu', () => {
    renderLanding();

    const menuButton = screen.getByRole('button', { name: 'Open navigation' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(mobileNavigation).toHaveTextContent('How it works');
    expect(mobileNavigation).toHaveTextContent('Features');
    expect(mobileNavigation).toHaveTextContent('Pricing');
    expect(mobileNavigation).toHaveTextContent('FAQ');
    expect(mobileNavigation).toHaveTextContent('Guides');
    expect(mobileNavigation).toHaveTextContent('Sign in');
    expect(screen.getAllByRole('link', { name: 'Sign in' }).find((link) => link.closest('nav') === mobileNavigation)).toHaveAttribute('href', '/sign-in');

    fireEvent.click(screen.getAllByRole('link', { name: 'FAQ' }).find((link) => link.closest('nav') === mobileNavigation)!);
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
  });

  it('closes the mobile menu with Escape and returns focus to its trigger', () => {
    renderLanding();

    const menuButton = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(menuButton);
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it('does not request the account client for a new public visitor', async () => {
    renderLanding();

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(state.getSession).not.toHaveBeenCalled();
    expect(state.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('sends a signed-in visitor to their dashboard instead of showing a public upload route', async () => {
    state.session = { user: { id: 'user-1' } };
    window.localStorage.setItem('sb-payslip-insights-auth-token', 'session-present');
    renderLanding();

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dashboard'));
  });
});
