import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaxHelper from './TaxHelper';

const state = vi.hoisted(() => ({ isDemo: true }));

function installLocalStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => { values.delete(key); },
      setItem: (key: string, value: string) => { values.set(key, String(value)); },
    },
  });
}

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { country: 'UK' } }),
}));

vi.mock('@/hooks/use-payslip-data', () => ({
  usePayslips: () => ({ data: [], isError: false, isLoading: false }),
}));

vi.mock('@/contexts/DemoContext', () => ({
  useDemo: () => ({ isDemo: state.isDemo }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

describe('TaxHelper', () => {
  beforeEach(() => {
    state.isDemo = true;
    installLocalStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with the last completed UK tax year and sample evidence', () => {
    render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Last completed' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '3 confirmed payslips ready' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your 2025/26 review' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open payslip history/i })).toHaveAttribute('href', '/dashboard#pay-history-heading');
    expect(screen.getByRole('link', { name: /open your official account/i })).toHaveAttribute('href', 'https://www.gov.uk/personal-tax-account');
  });

  it('switches tax year without implying a refund calculation', () => {
    render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Current year' }));

    expect(screen.getByRole('heading', { name: 'Your 2026/27 review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '0 confirmed payslips ready' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guidance, not a refund calculation' })).toBeInTheDocument();
    expect(screen.getByText(/does not calculate your final liability/i)).toBeInTheDocument();
  });

  it('tracks checklist progress only after an explicit review action', () => {
    render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /mark as reviewed: bring your confirmed pay together/i }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('1 of 5 reviewed')).toBeInTheDocument();
  });

  it('keeps real-account progress on this browser and separates each tax year', () => {
    state.isDemo = false;
    const firstVisit = render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /mark as reviewed: bring your confirmed pay together/i }));
    expect(screen.getByText('Saved on this browser')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    firstVisit.unmount();

    render(<MemoryRouter><TaxHelper /></MemoryRouter>);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('button', { name: /mark as not reviewed: bring your confirmed pay together/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Current year' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Last completed' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });
});
