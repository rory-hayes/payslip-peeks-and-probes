import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Payslip } from '@/lib/types';
import ExpectedVsActualChart from './ExpectedVsActualChart';
import YearToDateChart from './YearToDateChart';

const CURRENT_YEAR = new Date().getFullYear();
const FEB_SHORT_YEAR = `Feb ${String(CURRENT_YEAR).slice(-2)}`;

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({
    data: {
      annual_salary: 42_000,
      country: 'UK',
      has_pension: false,
      has_student_loan: false,
      pension_percent: null,
      student_loan_plan: null,
      sub_region: null,
      filing_status: null,
    },
  }),
  useCurrency: () => ({
    symbol: '£',
    format: (value: number) => `£${value.toFixed(2)}`,
  }),
}));

vi.mock('@/lib/tax-calculator', () => ({
  calculateExpectedMonthly: () => ({
    grossMonthly: 3_500,
    incomeTax: 300,
    netPay: 2_000,
  }),
}));

vi.mock('@/lib/tax-estimate-availability', () => ({
  getTaxEstimateAvailability: () => ({ available: true }),
}));

vi.mock('recharts', () => {
  const ChartContainer = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const SvgChart = ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>;
  const EmptyPrimitive = () => null;
  return {
    Area: EmptyPrimitive,
    AreaChart: SvgChart,
    Bar: EmptyPrimitive,
    BarChart: SvgChart,
    CartesianGrid: EmptyPrimitive,
    Legend: EmptyPrimitive,
    ReferenceLine: EmptyPrimitive,
    ResponsiveContainer: ChartContainer,
    Tooltip: EmptyPrimitive,
    XAxis: EmptyPrimitive,
    YAxis: EmptyPrimitive,
  };
});

function payslip(overrides: Partial<Payslip>): Payslip {
  return {
    anomaly_count: 0,
    country: 'UK',
    employer_name: 'Acme Ltd',
    file_name: 'payslip.pdf',
    gross_pay: 3_000,
    id: 'payslip-1',
    net_pay: 2_100,
    pay_date: '2026-01-31',
    pay_period_end: '2026-01-31',
    pay_period_start: '2026-01-01',
    status: 'confirmed',
    tax_amount: 400,
    total_deductions: 900,
    ...overrides,
  };
}

describe('Financial history charts', () => {
  it('gives the expected-versus-actual chart a concise summary and a complete data table', () => {
    render(
      <ExpectedVsActualChart
        payslips={[
          payslip({ id: 'jan', pay_date: `${CURRENT_YEAR}-01-31`, net_pay: 2_050 }),
          payslip({ id: 'feb', pay_date: `${CURRENT_YEAR}-02-28`, net_pay: 2_100 }),
        ]}
      />,
    );

    const figure = screen.getByRole('figure', { name: 'Expected vs Actual — Over Time' });
    expect(figure).toHaveAccessibleDescription(`Latest confirmed pay for ${FEB_SHORT_YEAR}: actual net pay £2100.00, compared with estimated net pay £2000.00.`);

    const table = within(figure).getByRole('table', { name: 'Expected and actual net pay by confirmed payslip' });
    expect(within(table).getByRole('columnheader', { name: 'Difference' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: FEB_SHORT_YEAR })).toBeInTheDocument();
    expect(within(table).getByText('£100.00')).toBeInTheDocument();
  });

  it('gives the cumulative year-to-date chart a summary and transparent monthly values', () => {
    render(
      <YearToDateChart
        payslips={[
          payslip({ id: 'jan', pay_date: `${CURRENT_YEAR}-01-31`, gross_pay: 3_000, tax_amount: 400, net_pay: 2_100 }),
          payslip({ id: 'feb', pay_date: `${CURRENT_YEAR}-02-28`, gross_pay: 3_100, tax_amount: 450, net_pay: 2_150 }),
        ]}
      />,
    );

    const figure = screen.getByRole('figure', { name: `${CURRENT_YEAR} Cumulative Year-to-Date` });
    expect(figure).toHaveAccessibleDescription('Cumulative confirmed pay through Feb: gross pay £6100.00, tax £850.00, and net pay £4250.00.');

    const table = within(figure).getByRole('table', { name: 'Cumulative gross pay, tax, and net pay by confirmed payslip' });
    expect(within(table).getByRole('columnheader', { name: 'Cumulative net pay' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Feb' })).toBeInTheDocument();
    expect(within(table).getByText('£4250.00')).toBeInTheDocument();
  });

  it('uses an explicit journey currency instead of an unrelated profile fallback', () => {
    const formatDemoCurrency = (value: number) => `DEMO-£${value.toFixed(2)}`;

    render(
      <YearToDateChart
        currencySymbol="£"
        formatCurrency={formatDemoCurrency}
        payslips={[
          payslip({ id: 'jan', pay_date: `${CURRENT_YEAR}-01-31`, gross_pay: 3_000, tax_amount: 400, net_pay: 2_100 }),
          payslip({ id: 'feb', pay_date: `${CURRENT_YEAR}-02-28`, gross_pay: 3_100, tax_amount: 450, net_pay: 2_150 }),
        ]}
      />,
    );

    const figure = screen.getByRole('figure', { name: `${CURRENT_YEAR} Cumulative Year-to-Date` });
    expect(figure).toHaveAccessibleDescription(
      'Cumulative confirmed pay through Feb: gross pay DEMO-£6100.00, tax DEMO-£850.00, and net pay DEMO-£4250.00.',
    );
    expect(within(figure).getByText('DEMO-£4250.00')).toBeInTheDocument();
  });
});
