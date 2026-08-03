import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Plan from './Plan';
import type { Payslip } from '@/lib/types';

const state = vi.hoisted(() => ({
  isError: false,
  isLoading: false,
  payslips: [] as Payslip[],
}));

vi.mock('@/hooks/use-payslip-data', () => ({
  usePayslips: () => ({
    data: state.payslips,
    isError: state.isError,
    isLoading: state.isLoading,
  }),
}));

vi.mock('@/hooks/use-profile', () => ({
  useCurrency: () => ({
    format: (amount: number) => `£${amount.toFixed(2)}`,
    symbol: '£',
  }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const confirmedPayslip: Payslip = {
  anomaly_count: 0,
  country: 'UK',
  employer_name: 'Northwind Studio',
  file_name: 'payslip.pdf',
  gross_pay: 2200,
  id: 'payslip-1',
  net_pay: 1500,
  pay_date: '2026-07-31',
  pay_period_end: '2026-07-31',
  pay_period_start: '2026-07-01',
  status: 'confirmed',
  tax_amount: 400,
  total_deductions: 700,
};

function renderPlan() {
  return render(<MemoryRouter><Plan /></MemoryRouter>);
}

describe('Plan', () => {
  beforeEach(() => {
    state.isError = false;
    state.isLoading = false;
    state.payslips = [];
  });

  it('keeps the no-payslip state pointed at the secure upload flow', () => {
    renderPlan();

    expect(screen.getByRole('heading', { name: 'Start with the pay you received.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check a payslip/i })).toHaveAttribute('href', '/vault');
    expect(screen.getByRole('link', { name: /use the pay calculator/i })).toHaveAttribute('href', '/calculator');
  });

  it('uses only a confirmed payslip and keeps setup as an unsaved working draft', () => {
    state.payslips = [confirmedPayslip];
    renderPlan();

    expect(screen.getByRole('heading', { name: 'Plan until payday.' })).toBeInTheDocument();
    expect(screen.getByText('£1500.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /set up this payday/i }));

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Essential bills amount' }), { target: { value: '200' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Everyday spending amount' }), { target: { value: '25' } });

    expect(screen.getByText('Left to assign')).toBeInTheDocument();
    expect(screen.getByText('£1275.00')).toBeInTheDocument();
    expect(screen.getByText(/not saved to your account or used to move money/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check figures in the calculator/i })).toHaveAttribute('href', '/calculator');
  });
});
