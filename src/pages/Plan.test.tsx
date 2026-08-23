import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Plan from './Plan';
import type { BufferGoal } from '@/hooks/use-buffer-goal';
import type { PaydayCheckIn, PaydayPlan } from '@/hooks/use-payday-plan';
import { inferNextPayday } from '@/lib/payday-plan-utils';
import type { Payslip } from '@/lib/types';

const state = vi.hoisted(() => ({
  activePlan: null as PaydayPlan | null,
  bufferGoal: null as BufferGoal | null,
  bufferGoalIsError: false,
  bufferGoalIsLoading: false,
  bufferGoalSavePending: false,
  bufferGoalMutate: vi.fn(),
  paydayCheckInSavePending: false,
  paydayCheckInMutate: vi.fn(),
  isPlanError: false,
  isPlanLoading: false,
  isSavePending: false,
  isError: false,
  isLoading: false,
  mutate: vi.fn(),
  payslips: [] as Payslip[],
}));

vi.mock('@/hooks/use-payslip-data', () => ({
  usePayslips: () => ({
    data: state.payslips,
    isError: state.isError,
    isLoading: state.isLoading,
  }),
}));

vi.mock('@/hooks/use-payday-plan', () => ({
  useActivePaydayPlan: () => ({
    data: state.activePlan,
    isError: state.isPlanError,
    isLoading: state.isPlanLoading,
  }),
  useSavePaydayPlan: () => ({
    isPending: state.isSavePending,
    mutate: state.mutate,
  }),
  useSavePaydayCheckIn: () => ({
    isPending: state.paydayCheckInSavePending,
    mutate: state.paydayCheckInMutate,
  }),
}));

vi.mock('@/hooks/use-buffer-goal', () => ({
  usePrimaryBufferGoal: () => ({
    data: state.bufferGoal,
    isError: state.bufferGoalIsError,
    isLoading: state.bufferGoalIsLoading,
  }),
  useSavePrimaryBufferGoal: () => ({
    isPending: state.bufferGoalSavePending,
    mutate: state.bufferGoalMutate,
  }),
}));

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { pay_frequency: null } }),
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

const previousConfirmedPayslip: Payslip = {
  ...confirmedPayslip,
  id: 'payslip-0',
  net_pay: 1480,
  pay_date: '2026-06-30',
};

function renderPlan() {
  return render(<MemoryRouter><Plan /></MemoryRouter>);
}

describe('Plan', () => {
  beforeEach(() => {
    state.activePlan = null;
    state.bufferGoal = null;
    state.bufferGoalIsError = false;
    state.bufferGoalIsLoading = false;
    state.bufferGoalSavePending = false;
    state.bufferGoalMutate.mockReset();
    state.paydayCheckInSavePending = false;
    state.paydayCheckInMutate.mockReset();
    state.isError = false;
    state.isLoading = false;
    state.isPlanError = false;
    state.isPlanLoading = false;
    state.isSavePending = false;
    state.mutate.mockReset();
    state.payslips = [];
  });

  it('keeps the no-payslip state pointed at the secure upload flow', () => {
    renderPlan();

    expect(screen.getByRole('heading', { name: 'Start with the pay you received.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check a payslip/i })).toHaveAttribute('href', '/vault');
    expect(screen.getByRole('link', { name: /use the pay calculator/i })).toHaveAttribute('href', '/calculator');
  });

  it('takes a person straight back into a protected review when a payslip is ready', () => {
    state.payslips = [{
      ...confirmedPayslip,
      id: 'review-1',
      net_pay: 0,
      pay_date: '',
      status: 'extracted',
    }];
    renderPlan();

    expect(screen.getByRole('heading', { name: 'Your payslip is ready to review.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review my payslip/i })).toHaveAttribute('href', '/vault?review=review-1');
  });

  it('uses only a confirmed payslip and tells the person to check the suggested payday', () => {
    state.payslips = [
      { ...confirmedPayslip, id: 'needs-review', net_pay: 9999, status: 'extracted' },
      previousConfirmedPayslip,
      confirmedPayslip,
    ];
    renderPlan();

    expect(screen.getByRole('heading', { name: 'Plan until payday.' })).toBeInTheDocument();
    expect(screen.getByText('£1,500.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /set up this payday/i }));

    expect(screen.getByLabelText('Next payday')).toHaveValue('2026-08-31');
    expect(screen.getByText(/check it against your expected payday/i)).toBeInTheDocument();
    expect(screen.getByText(/does not access a bank, move money, or replace checking your original payslip/i)).toBeInTheDocument();
  });

  it('saves an eligible confirmed-payslip plan and shows the saved state', () => {
    state.payslips = [previousConfirmedPayslip, confirmedPayslip];
    state.mutate.mockImplementation((input, options) => {
      options.onSuccess?.({
        allocations: input.allocations,
        currency: 'GBP',
        id: 'plan-1',
      netPay: 1500,
      nextPayday: input.nextPayday,
      payDate: '2026-07-31',
      payslipId: input.payslipId,
      status: 'active',
      updatedAt: '2026-08-03T12:00:00Z',
      everydayCheckedInAt: null,
      everydayRemaining: null,
      });
    });
    renderPlan();
    fireEvent.click(screen.getByRole('button', { name: /set up this payday/i }));

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Essential bills amount' }), { target: { value: '800' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Everyday spending amount' }), { target: { value: '250' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Build my buffer amount' }), { target: { value: '125' } });
    fireEvent.change(screen.getByLabelText('Next payday'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save this payday plan' }));

    expect(state.mutate).toHaveBeenCalledWith({
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      nextPayday: '2026-08-31',
      payslipId: 'payslip-1',
    }, expect.any(Object));
    expect(screen.getByRole('status')).toHaveTextContent('Saved for this pay cycle through 31 Aug 2026.');
    expect(screen.getByRole('button', { name: 'Edit Essential bills' })).toHaveTextContent('£800.00');
    expect(screen.getByRole('button', { name: 'Edit this payday' })).toBeInTheDocument();
  });

  it('keeps entries in place and explains a failed save without exposing a raw provider error', () => {
    state.payslips = [previousConfirmedPayslip, confirmedPayslip];
    state.mutate.mockImplementation((_input, options) => options.onError?.(new Error('unexpected provider internals')));
    renderPlan();
    fireEvent.click(screen.getByRole('button', { name: /set up this payday/i }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Essential bills amount' }), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save this payday plan' }));

    expect(screen.getByRole('alert')).toHaveTextContent('We could not save your payday plan. Your entries are still here, so please try again.');
    expect(screen.getByRole('spinbutton', { name: 'Essential bills amount' })).toHaveValue(800);
  });

  it('does not allow an over-allocated plan to be saved', () => {
    state.payslips = [previousConfirmedPayslip, confirmedPayslip];
    renderPlan();
    fireEvent.click(screen.getByRole('button', { name: /set up this payday/i }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Essential bills amount' }), { target: { value: '1600' } });

    expect(screen.getByText('Allocated over take-home pay')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save this payday plan' })).toBeDisabled();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it('uses the confirmed payslip currency instead of a profile preference', () => {
    state.payslips = [{ ...confirmedPayslip, country: 'Ireland' }];
    renderPlan();

    expect(screen.getByText('€1,500.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /set up this payday/i }));
    expect(screen.getAllByText('€', { selector: '.payday-plan__money-input span' })).toHaveLength(3);
  });

  it('turns an existing everyday-spending allocation into a clearly labelled daily guide', () => {
    state.payslips = [confirmedPayslip];
    state.activePlan = {
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      currency: 'GBP',
      everydayCheckedInAt: null,
      everydayRemaining: null,
      id: 'plan-1',
      netPay: 1500,
      nextPayday: '2099-08-31',
      payDate: '2026-07-31',
      payslipId: 'payslip-1',
      status: 'active',
      updatedAt: '2026-08-03T12:00:00Z',
    };
    renderPlan();

    expect(screen.getByText('Everyday spending guide')).toBeInTheDocument();
    expect(screen.getByText(/planning guide, not your bank balance/i)).toBeInTheDocument();
  });

  it('lets a person save a manual payday check-in within their everyday plan amount', () => {
    state.payslips = [confirmedPayslip];
    state.activePlan = {
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      currency: 'GBP',
      everydayCheckedInAt: null,
      everydayRemaining: null,
      id: 'plan-1',
      netPay: 1500,
      nextPayday: '2099-08-31',
      payDate: '2026-07-31',
      payslipId: 'payslip-1',
      status: 'active',
      updatedAt: '2026-08-03T12:00:00Z',
    };
    state.paydayCheckInMutate.mockImplementation((input, options) => {
      options.onSuccess?.({
        checkedInAt: '2026-08-04T12:00:00Z',
        everydayRemaining: input.everydayRemaining,
        planId: input.planId,
      } satisfies PaydayCheckIn);
    });
    renderPlan();

    expect(screen.getByRole('heading', { name: 'A quick payday check-in.' })).toBeInTheDocument();
    expect(screen.getByText(/planning check, not a bank balance/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a check-in' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Everyday money left' }), { target: { value: '140' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save check-in' }));

    expect(state.paydayCheckInMutate).toHaveBeenCalledWith({
      everydayRemaining: 140,
      planId: 'plan-1',
    }, expect.any(Object));
    expect(screen.getByRole('status')).toHaveTextContent('Your payday check-in is saved.');
    expect(screen.getByText('£140.00')).toBeInTheDocument();
    expect(screen.getByText('of £250.00')).toBeInTheDocument();
  });

  it('keeps the dashboard check-in destination focusable after hash navigation', () => {
    state.payslips = [confirmedPayslip];
    state.activePlan = {
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      currency: 'GBP',
      everydayCheckedInAt: null,
      everydayRemaining: null,
      id: 'plan-1',
      netPay: 1500,
      nextPayday: '2099-08-31',
      payDate: '2026-07-31',
      payslipId: 'payslip-1',
      status: 'active',
      updatedAt: '2026-08-03T12:00:00Z',
    };
    renderPlan();

    expect(document.getElementById('payday-check-in')).toHaveAttribute('tabindex', '-1');
  });

  it('does not offer a new check-in after the saved pay cycle has ended', () => {
    state.payslips = [confirmedPayslip];
    state.activePlan = {
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      currency: 'GBP',
      everydayCheckedInAt: null,
      everydayRemaining: null,
      id: 'plan-1',
      netPay: 1500,
      nextPayday: '2000-08-31',
      payDate: '2026-07-31',
      payslipId: 'payslip-1',
      status: 'active',
      updatedAt: '2000-08-03T12:00:00Z',
    };
    renderPlan();

    expect(screen.getByText(/that pay cycle ended 31 aug 2000/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'A quick payday check-in.' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /check-in/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit this payday' })).toBeInTheDocument();
  });

  it('shows and updates the manual one-payday buffer goal without treating it as a bank balance', () => {
    state.payslips = [confirmedPayslip];
    state.bufferGoal = {
      currency: 'GBP',
      currentAmount: 250,
      id: 'goal-1',
      targetAmount: 1000,
      updatedAt: '2026-08-03T12:00:00Z',
    };
    state.bufferGoalMutate.mockImplementation((input, options) => {
      options.onSuccess?.({
        currency: 'GBP',
        currentAmount: input.currentAmount,
        id: 'goal-1',
        targetAmount: input.targetAmount,
        updatedAt: '2026-08-03T12:00:00Z',
      });
    });
    renderPlan();

    expect(screen.getByText('One-payday buffer.')).toBeInTheDocument();
    expect(screen.getByText('£250.00')).toBeInTheDocument();
    expect(screen.getByText('of £1,000.00')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /buffer progress/i })).toHaveAttribute('aria-valuenow', '250');

    fireEvent.click(screen.getByRole('button', { name: 'Update buffer goal' }));
    fireEvent.change(screen.getByLabelText('Buffer target'), { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText('Already set aside'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update buffer goal' }));

    expect(state.bufferGoalMutate).toHaveBeenCalledWith({
      currency: 'GBP',
      currentAmount: 300,
      targetAmount: 1200,
    }, expect.any(Object));
    expect(screen.getByRole('status')).toHaveTextContent('Your one-payday buffer goal is saved.');
    expect(screen.getByText('of £1,200.00')).toBeInTheDocument();
  });

  it('waits for a saved buffer goal before offering an edit that could overwrite it', () => {
    state.payslips = [confirmedPayslip];
    state.bufferGoalIsLoading = true;
    renderPlan();

    expect(screen.getByText('Loading your saved buffer goal…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /buffer goal/i })).not.toBeInTheDocument();
  });
});

describe('inferNextPayday', () => {
  it('uses the most recent confirmed pay interval and rolls a stale cycle forward', () => {
    expect(inferNextPayday(confirmedPayslip, [previousConfirmedPayslip, confirmedPayslip], '2026-08-03')).toBe('2026-08-31');
    expect(inferNextPayday(confirmedPayslip, [previousConfirmedPayslip, confirmedPayslip], '2026-09-02')).toBe('2026-10-01');
  });

  it('falls back to an editable monthly suggestion when the earlier date is implausible', () => {
    expect(inferNextPayday(confirmedPayslip, [{ ...previousConfirmedPayslip, pay_date: '2026-02-01' }, confirmedPayslip], '2026-08-03')).toBe('2026-08-30');
  });
});
