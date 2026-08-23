import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { PaydayPlan } from '@/hooks/use-payday-plan';
import PaydayPlanPulse from './PaydayPlanPulse';

const plan: PaydayPlan = {
  allocations: { buffer: 125, essentialBills: 800, everydaySpending: 250 },
  currency: 'GBP',
  everydayCheckedInAt: null,
  everydayRemaining: null,
  id: 'plan-1',
  netPay: 1500,
  nextPayday: '2099-08-31',
  payDate: '2099-08-01',
  payslipId: 'payslip-1',
  status: 'active',
  updatedAt: '2099-08-03T12:00:00Z',
};

function renderPulse(pulsePlan: PaydayPlan, daysUntilNextPayday = 5) {
  return render(
    <MemoryRouter>
      <PaydayPlanPulse daysUntilNextPayday={daysUntilNextPayday} plan={pulsePlan} />
    </MemoryRouter>,
  );
}

describe('PaydayPlanPulse', () => {
  it('sends a first-time check-in to the existing manual plan form', () => {
    renderPulse(plan);

    expect(screen.getByRole('heading', { name: 'Weekly plan pulse' })).toBeInTheDocument();
    expect(screen.getByText(/you planned £250\.00 for everyday spending/i)).toBeInTheDocument();
    expect(screen.getByText(/planning guide, not a bank balance or financial advice/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add a check-in/i })).toHaveAttribute('href', '/plan#payday-check-in');
  });

  it('turns a current saved check-in into a neutral daily planning guide', () => {
    renderPulse({
      ...plan,
      everydayCheckedInAt: new Date().toISOString(),
      everydayRemaining: 140,
    });

    expect(screen.getByRole('heading', { name: 'Plan pulse' })).toBeInTheDocument();
    expect(screen.getByText(/£140\.00 remaining in this plan/i)).toBeInTheDocument();
    expect(screen.getByText(/about £28\.00 a day for the next 5 days/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /update check-in/i })).toHaveAttribute('href', '/plan#payday-check-in');
  });

  it('does not create a dead check-in destination when no everyday amount was planned', () => {
    const { container } = renderPulse({
      ...plan,
      allocations: { ...plan.allocations, everydaySpending: 0 },
    });

    expect(container).toBeEmptyDOMElement();
  });
});
