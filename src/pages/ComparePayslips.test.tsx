import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ComparePayslips from './ComparePayslips';
import type { Payslip } from '@/lib/types';

const state = vi.hoisted(() => ({
  isLoading: false,
  isError: false,
  payslips: [] as Payslip[],
  refetch: vi.fn(),
}));

vi.mock('@/hooks/use-payslip-data', () => ({
  usePayslips: () => ({ data: state.payslips, isError: state.isError, isLoading: state.isLoading, refetch: state.refetch }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

function payslip(overrides: Partial<Payslip> = {}): Payslip {
  return {
    anomaly_count: 0,
    country: 'UK',
    employer_name: 'Example Ltd',
    file_name: 'payslip.pdf',
    gross_pay: 3_000,
    id: 'payslip',
    net_pay: 2_300,
    pay_date: '2026-03-31',
    pay_period_end: '2026-03-31',
    pay_period_start: '2026-03-01',
    status: 'confirmed',
    tax_amount: 400,
    total_deductions: 700,
    ...overrides,
  };
}

describe('ComparePayslips', () => {
  beforeEach(() => {
    state.isLoading = false;
    state.isError = false;
    state.payslips = [];
    state.refetch.mockReset();
  });

  it('does not show figures when a URL selects an unconfirmed payslip', () => {
    state.payslips = [
      payslip({ id: 'confirmed-jan', pay_date: '2026-01-31' }),
      payslip({ id: 'needs-review-feb', pay_date: '2026-02-28', status: 'extracted', net_pay: 999_999 }),
    ];

    render(
      <MemoryRouter initialEntries={['/compare?current=needs-review-feb&previous=confirmed-jan']}>
        <ComparePayslips />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Review a payslip before comparing' })).toBeInTheDocument();
    expect(screen.queryByText('Net pay')).not.toBeInTheDocument();
    expect(screen.queryByText(/999,999/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to vault/i })).toHaveAttribute('href', '/vault');
  });

  it('does not confuse a data-load failure with unavailable comparison history', () => {
    state.isError = true;

    render(
      <MemoryRouter initialEntries={['/compare?current=current&previous=previous']}>
        <ComparePayslips />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'We couldn’t load the payslips for this comparison.' })).toBeInTheDocument();
    expect(screen.queryByText('Need two confirmed payslips to compare')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it('renders Irish confirmed payslips with Irish deduction terms and review language', () => {
    state.payslips = [
      payslip({
        country: 'Ireland',
        id: 'ireland-jan',
        pay_date: '2026-01-31',
        pension_amount: 100,
        prsi_amount: 120,
        usc_amount: 40,
      }),
      payslip({
        country: 'Ireland',
        id: 'ireland-feb',
        pay_date: '2026-02-28',
        pension_amount: 100,
        prsi_amount: 130,
        usc_amount: 45,
      }),
    ];

    render(
      <MemoryRouter initialEntries={['/compare?current=ireland-feb&previous=ireland-jan']}>
        <ComparePayslips />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Compare payslips' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to saved payslips' })).toHaveAttribute('href', '/vault');
    expect(screen.getByText('PRSI')).toBeInTheDocument();
    expect(screen.getByText('USC')).toBeInTheDocument();
    expect(screen.queryByText('National Insurance')).not.toBeInTheDocument();
    expect(screen.getAllByText(/€/).length).toBeGreaterThan(0);
    expect(screen.getByText(/cannot tell you whether payroll is correct/i)).toBeInTheDocument();
  });
});
