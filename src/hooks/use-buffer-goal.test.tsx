import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrimaryBufferGoal, useSavePrimaryBufferGoal } from './use-buffer-goal';

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  maybeSingle: vi.fn(),
  selectExisting: vi.fn(),
  selectResult: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
  user: { id: 'user-123' } as { id: string } | null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createWrapper(queryClient = createQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('one-payday buffer goal data access', () => {
  beforeEach(() => {
    mocks.user = { id: 'user-123' };
    mocks.eq.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.selectExisting.mockReset();
    mocks.selectResult.mockReset();
    mocks.single.mockReset();
    mocks.update.mockReset();
  });

  it('loads only the primary goal available to the signed-in person through RLS', async () => {
    mocks.from.mockReturnValue({ select: mocks.selectExisting });
    mocks.selectExisting.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        currency: 'GBP',
        current_amount: '250.00',
        id: 'goal-1',
        target_amount: '1000.00',
        updated_at: '2026-08-03T12:00:00Z',
      },
      error: null,
    });

    const { result } = renderHook(() => usePrimaryBufferGoal(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.from).toHaveBeenCalledWith('savings_goals');
    expect(mocks.eq).toHaveBeenCalledWith('is_primary', true);
    expect(result.current.data).toEqual({
      currency: 'GBP',
      currentAmount: 250,
      id: 'goal-1',
      targetAmount: 1000,
      updatedAt: '2026-08-03T12:00:00Z',
    });
  });

  it('creates a named primary goal with a current-user id that RLS must validate', async () => {
    const existingQuery = { select: mocks.selectExisting };
    mocks.selectExisting.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.insert.mockReturnValue({ select: mocks.selectResult });
    mocks.selectResult.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: {
        currency: 'EUR',
        current_amount: 125,
        id: 'goal-2',
        target_amount: 900,
        updated_at: '2026-08-03T12:00:00Z',
      },
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce({ insert: mocks.insert });

    const { result } = renderHook(() => useSavePrimaryBufferGoal(), { wrapper: createWrapper() });

    let savedGoal: Awaited<ReturnType<typeof result.current.mutateAsync>>;
    await act(async () => {
      savedGoal = await result.current.mutateAsync({
        currency: 'EUR',
        currentAmount: 125,
        targetAmount: 900,
      });
    });

    expect(mocks.insert).toHaveBeenCalledWith({
      currency: 'EUR',
      current_amount: 125,
      is_primary: true,
      name: 'One-payday buffer',
      target_amount: 900,
      user_id: 'user-123',
    });
    expect(savedGoal).toEqual({
      currency: 'EUR',
      currentAmount: 125,
      id: 'goal-2',
      targetAmount: 900,
      updatedAt: '2026-08-03T12:00:00Z',
    });
  });

  it('updates the existing primary goal instead of creating another one', async () => {
    mocks.selectExisting.mockReturnValue({ eq: mocks.eq });
    mocks.eq
      .mockReturnValueOnce({ maybeSingle: mocks.maybeSingle })
      .mockReturnValueOnce({ select: mocks.selectResult });
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'goal-1' }, error: null });
    mocks.selectResult.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: {
        currency: 'GBP',
        current_amount: 400,
        id: 'goal-1',
        target_amount: 1000,
        updated_at: '2026-08-03T13:00:00Z',
      },
      error: null,
    });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from
      .mockReturnValueOnce({ select: mocks.selectExisting })
      .mockReturnValueOnce({ update: mocks.update });

    const { result } = renderHook(() => useSavePrimaryBufferGoal(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        currency: 'GBP',
        currentAmount: 400,
        targetAmount: 1000,
      });
    });

    expect(mocks.update).toHaveBeenCalledWith({
      currency: 'GBP',
      current_amount: 400,
      is_primary: true,
      name: 'One-payday buffer',
      target_amount: 1000,
      user_id: 'user-123',
    });
    expect(mocks.eq).toHaveBeenLastCalledWith('id', 'goal-1');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('does not write a goal when nobody is authenticated', async () => {
    mocks.user = null;
    const { result } = renderHook(() => useSavePrimaryBufferGoal(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync({
      currency: 'GBP',
      currentAmount: 0,
      targetAmount: 500,
    })).rejects.toThrow('Sign in before saving a buffer goal.');

    expect(mocks.from).not.toHaveBeenCalled();
  });
});
