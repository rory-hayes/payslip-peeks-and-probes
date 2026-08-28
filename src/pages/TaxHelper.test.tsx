import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaxHelper from './TaxHelper';

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
  useDemo: () => ({ isDemo: true }),
}));

describe('TaxHelper', () => {
  beforeEach(() => {
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
});
