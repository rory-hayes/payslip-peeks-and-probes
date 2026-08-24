import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PayslipDetail from './PayslipDetail';
import type { Payslip } from '@/lib/types';

const state = vi.hoisted(() => ({
  payslips: [] as Payslip[],
  payslipError: false,
  refetchPayslip: vi.fn(),
  slip: null as Payslip | null,
}));

vi.mock('@/hooks/use-payslip-data', () => ({
  useAnomalies: () => ({ data: [], isLoading: false }),
  usePayslip: () => ({ data: state.slip, error: state.payslipError ? new Error('network unavailable') : null, isLoading: false, refetch: state.refetchPayslip }),
  usePayslips: () => ({ data: state.payslips, isLoading: false }),
}));

vi.mock('@/hooks/use-profile', () => ({
  useCurrency: () => ({ format: (amount: number) => `£${amount.toFixed(2)}` }),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/use-anomaly-status', () => ({ useUpdateAnomalyStatus: () => ({ isPending: false, mutate: vi.fn() }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
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

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/payslip/current']}>
      <Routes>
        <Route path="/payslip/:id" element={<PayslipDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PayslipDetail comparison link', () => {
  beforeEach(() => {
    state.payslips = [];
    state.payslipError = false;
    state.refetchPayslip.mockReset();
    state.slip = null;
  });

  it('only offers a compatible confirmed comparison from the detail page', () => {
    const current = payslip({ id: 'current', country: 'UK', pay_date: '2026-03-31' });
    state.slip = current;
    state.payslips = [
      payslip({ id: 'uk-jan', country: 'UK', pay_date: '2026-01-31' }),
      payslip({ id: 'ireland-feb', country: 'Ireland', pay_date: '2026-02-28' }),
      current,
    ];

    renderDetail();

    expect(screen.getByRole('link', { name: 'Back to saved payslips' })).toHaveAttribute('href', '/vault');
    expect(screen.getByRole('link', { name: /compare to/i })).toHaveAttribute(
      'href',
      '/compare?current=current&previous=uk-jan',
    );
  });

  it('does not offer a comparison action for a payslip that still needs review', () => {
    state.slip = payslip({ id: 'current', pay_date: '2026-03-31', status: 'extracted' });
    state.payslips = [
      payslip({ id: 'confirmed-jan', pay_date: '2026-01-31' }),
      state.slip,
    ];

    renderDetail();

    expect(screen.queryByRole('link', { name: /compare to/i })).not.toBeInTheDocument();
  });

  it('shows the extracted line items, year-to-date figures, and source evidence', () => {
    state.slip = payslip({
      extraction_confidence: 'medium',
      extraction_line_items: [{
        label: 'Basic pay',
        kind: 'earning',
        amount: 3_000,
        year_to_date_amount: 9_000,
        evidence: 'Basic pay £3,000.00',
        confidence: 'high',
      }],
      extraction_field_evidence: [{
        field: 'gross_pay',
        evidence: 'Gross pay £3,000.00',
        confidence: 'high',
      }],
      year_to_date: { gross_pay: 9_000, tax: 1_200, ni: 600, pension: 300 },
    });

    renderDetail();

    expect(screen.getByRole('heading', { name: 'Everything found on the payslip' })).toBeInTheDocument();
    expect(screen.getByText('Basic pay')).toBeInTheDocument();
    expect(screen.getByText('Year to date: £9000.00')).toBeInTheDocument();
    expect(screen.getByText('Show figure evidence (1)')).toBeInTheDocument();
    expect(screen.getByText('medium extraction confidence')).toBeInTheDocument();
  });

  it('does not report a transport failure as a missing payslip', () => {
    state.payslipError = true;

    renderDetail();

    expect(screen.getByRole('heading', { name: 'We couldn’t load this payslip.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Payslip not found' })).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(state.refetchPayslip).toHaveBeenCalledTimes(1);
  });
});
