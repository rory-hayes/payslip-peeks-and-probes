import { Link } from 'react-router';
import { ArrowRight, ClipboardCheck } from 'lucide-react';
import type { PaydayPlan } from '@/hooks/use-payday-plan';
import { getPaydayPlanPulseState } from '@/lib/payday-plan-pulse';

interface PaydayPlanPulseProps {
  daysUntilNextPayday: number;
  payFrequency?: string | null;
  plan: PaydayPlan;
}

function formatPlanCurrency(amount: number, currency: 'GBP' | 'EUR'): string {
  return new Intl.NumberFormat(currency === 'EUR' ? 'en-IE' : 'en-GB', {
    currency,
    style: 'currency',
  }).format(amount);
}

function formatCheckInDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export default function PaydayPlanPulse({ daysUntilNextPayday, payFrequency, plan }: PaydayPlanPulseProps) {
  const pulse = getPaydayPlanPulseState({
    daysUntilNextPayday,
    everydayCheckedInAt: plan.everydayCheckedInAt,
    everydayRemaining: plan.everydayRemaining,
    everydaySpending: plan.allocations.everydaySpending,
    payFrequency,
  });

  if (!pulse) return null;

  const plannedEveryday = formatPlanCurrency(plan.allocations.everydaySpending, plan.currency);
  const hasCurrentCheckIn = pulse.kind === 'current-check-in' && plan.everydayRemaining !== null;
  const dailyGuide = hasCurrentCheckIn
    ? formatPlanCurrency(plan.everydayRemaining / daysUntilNextPayday, plan.currency)
    : null;
  const checkedInDate = formatCheckInDate(pulse.lastCheckedInAt);
  const daysLabel = `${daysUntilNextPayday} ${daysUntilNextPayday === 1 ? 'day' : 'days'}`;
  const heading = hasCurrentCheckIn ? 'Plan pulse' : 'Weekly plan pulse';
  const actionLabel = pulse.kind === 'first-check-in' ? 'Add a check-in' : 'Update check-in';

  return (
    <section className="pi-dashboard__pulse" aria-labelledby="weekly-plan-pulse-heading">
      <div className="pi-dashboard__pulse-copy">
        <div className="pi-dashboard__pulse-icon" aria-hidden="true"><ClipboardCheck /></div>
        <div>
          <h2 id="weekly-plan-pulse-heading">{heading}</h2>
          <p>
            {pulse.kind === 'first-check-in'
              ? `You planned ${plannedEveryday} for everyday spending. Add your own view of what remains whenever a clearer view would help.`
              : pulse.kind === 'check-in-due'
                ? checkedInDate
                  ? `Your last manual check-in was ${checkedInDate}. Refresh it whenever a clearer view of the remaining ${daysLabel} would help.`
                  : 'Refresh your manual check-in whenever a clearer view of the remaining days would help.'
                : <>Your last manual check-in: <strong>{formatPlanCurrency(plan.everydayRemaining ?? 0, plan.currency)} remaining in this plan.</strong> About {dailyGuide} a day for the next {daysLabel}.</>}
          </p>
          <span className="pi-dashboard__pulse-note">Planning guide, not a bank balance or financial advice.</span>
        </div>
      </div>
      <Link className="pi-dashboard__pulse-action" to="/plan#payday-check-in">
        {actionLabel}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
