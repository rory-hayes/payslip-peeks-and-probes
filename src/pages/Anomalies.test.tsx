import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Anomalies from './Anomalies';
import type { AnomalyResult } from '@/lib/types';

const state = vi.hoisted(() => ({
  anomalies: [] as AnomalyResult[],
  isError: false,
  isLoading: false,
  mutate: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('@/hooks/use-payslip-data', () => ({
  useAnomalies: () => ({
    data: state.anomalies,
    isError: state.isError,
    isLoading: state.isLoading,
    refetch: state.refetch,
  }),
}));

vi.mock('@/hooks/use-anomaly-status', () => ({
  useUpdateAnomalyStatus: () => ({ isPending: false, mutate: state.mutate }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

function anomaly(overrides: Partial<AnomalyResult> = {}): AnomalyResult {
  return {
    anomaly_type: 'tax_change',
    confidence: 'high',
    description: 'What changed: Income tax is higher than the previous payslip.\n\nWhy it matters: Check that your tax code is correct.',
    employer_name: 'Example Ltd',
    id: 'anomaly-1',
    payslip_date: '2026-03-31',
    payslip_id: 'payslip-1',
    severity: 'medium',
    status: 'new',
    suggested_action: 'Ask payroll to check the change.',
    title: 'Income tax changed',
    ...overrides,
  };
}

describe('Anomalies accessibility', () => {
  beforeEach(() => {
    state.anomalies = [anomaly()];
    state.isError = false;
    state.isLoading = false;
    state.mutate.mockReset();
    state.refetch.mockReset();
  });

  it('exposes the active filter and details expansion state', () => {
    render(
      <MemoryRouter>
        <Anomalies />
      </MemoryRouter>,
    );

    expect(screen.getByRole('group', { name: 'Filter flagged items' })).toBeInTheDocument();
    const allFilter = screen.getByRole('button', { name: 'All (1)' });
    const newFilter = screen.getByRole('button', { name: 'New (1)' });
    expect(allFilter).toHaveAttribute('aria-pressed', 'true');
    expect(newFilter).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(newFilter);
    expect(allFilter).toHaveAttribute('aria-pressed', 'false');
    expect(newFilter).toHaveAttribute('aria-pressed', 'true');

    const moreDetail = screen.getByRole('button', { name: 'More detail' });
    const detailId = moreDetail.getAttribute('aria-controls');
    expect(detailId).toBe('anomaly-detail-anomaly-1');
    expect(moreDetail).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(detailId!)).toBeInTheDocument();

    fireEvent.click(moreDetail);
    const lessDetail = screen.getByRole('button', { name: 'Less detail' });
    expect(lessDetail).toHaveAttribute('aria-controls', detailId);
    expect(lessDetail).toHaveAttribute('aria-expanded', 'true');
  });
});
