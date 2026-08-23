import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActivePaydayPlan, useSavePaydayCheckIn, useSavePaydayPlan } from './use-payday-plan';

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
  order: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  user: { id: 'user-123' } as { id: string } | null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient = createQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('payday plan data access', () => {
  beforeEach(() => {
    mocks.user = { id: 'user-123' };
    mocks.eq.mockReset();
    mocks.from.mockReset();
    mocks.limit.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.order.mockReset();
    mocks.rpc.mockReset();
    mocks.select.mockReset();

    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ order: mocks.order });
    mocks.order.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  it('loads only the active plan available through database row-level security', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        currency: 'GBP',
        everyday_checked_in_at: '2026-08-04T10:00:00Z',
        everyday_remaining: '165.50',
        id: 'plan-1',
        net_pay: '1500.00',
        next_payday: '2026-08-31',
        pay_date: '2026-07-31',
        payday_plan_allocations: [
          { amount: '800.00', category: 'essential_bills' },
          { amount: '250.00', category: 'everyday_spending' },
          { amount: '125.00', category: 'buffer' },
        ],
        payslip_id: 'payslip-1',
        status: 'active',
        updated_at: '2026-08-03T10:00:00Z',
      },
      error: null,
    });

    const { result } = renderHook(() => useActivePaydayPlan(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.from).toHaveBeenCalledWith('payday_plans');
    expect(mocks.eq).toHaveBeenCalledWith('status', 'active');
    expect(result.current.data).toMatchObject({
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      everydayCheckedInAt: '2026-08-04T10:00:00Z',
      everydayRemaining: 165.5,
      id: 'plan-1',
      netPay: 1500,
      payslipId: 'payslip-1',
    });
  });

  it('saves through the ownership-checked RPC without accepting client-supplied payslip figures', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        currency: 'GBP',
        id: 'plan-1',
        net_pay: 1500,
        next_payday: '2026-08-31',
        pay_date: '2026-07-31',
        payslip_id: 'payslip-1',
        status: 'active',
        updated_at: '2026-08-03T10:00:00Z',
      }],
      error: null,
    });
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useSavePaydayPlan(), { wrapper: createWrapper(queryClient) });

    let savedPlan: Awaited<ReturnType<typeof result.current.mutateAsync>>;
    await act(async () => {
      savedPlan = await result.current.mutateAsync({
        allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
        nextPayday: '2026-08-31',
        payslipId: 'payslip-1',
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith('save_payday_plan', {
      p_buffer: 125,
      p_essential_bills: 800,
      p_everyday_spending: 250,
      p_next_payday: '2026-08-31',
      p_payslip_id: 'payslip-1',
    });
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('user_id');
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('p_net_pay');
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('p_currency');
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('p_pay_date');
    expect(savedPlan).toMatchObject({
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      id: 'plan-1',
      payslipId: 'payslip-1',
    });
  });

  it('does not attempt a save when there is no authenticated person', async () => {
    mocks.user = null;
    const { result } = renderHook(() => useSavePaydayPlan(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync({
      allocations: { essentialBills: 1, everydaySpending: 0, buffer: 0 },
      nextPayday: '2026-08-31',
      payslipId: 'payslip-1',
    })).rejects.toThrow('Sign in before saving a payday plan.');

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('saves a manual check-in only through the active-plan RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        everyday_checked_in_at: '2026-08-04T11:00:00Z',
        everyday_remaining: 120,
        id: 'plan-1',
      }],
      error: null,
    });
    const { result } = renderHook(() => useSavePaydayCheckIn(), { wrapper: createWrapper() });

    let savedCheckIn: Awaited<ReturnType<typeof result.current.mutateAsync>>;
    await act(async () => {
      savedCheckIn = await result.current.mutateAsync({
        everydayRemaining: 120,
        planId: 'plan-1',
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith('save_payday_check_in', {
      p_everyday_remaining: 120,
      p_plan_id: 'plan-1',
    });
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('user_id');
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('p_everyday_spending');
    expect(savedCheckIn).toEqual({
      checkedInAt: '2026-08-04T11:00:00Z',
      everydayRemaining: 120,
      planId: 'plan-1',
    });
  });
});
