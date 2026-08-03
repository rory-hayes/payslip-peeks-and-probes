import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Calculator,
  CircleAlert,
  FileText,
  Home,
  PiggyBank,
  ShoppingBasket,
  WalletCards,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { usePayslips } from '@/hooks/use-payslip-data';
import { useCurrency } from '@/hooks/use-profile';
import { formatDate } from '@/lib/date-utils';
import type { Payslip } from '@/lib/types';
import aquaCorner from '@/assets/option-one-aqua-corner-v2.webp';
import './Plan.css';

type DraftField = 'essentialBills' | 'everydaySpending' | 'buffer';

type PlanDraft = Record<DraftField, string>;

type PlanRow = {
  field: DraftField;
  icon: typeof Home;
  label: string;
  hint: string;
  tone: 'violet' | 'aqua' | 'coral';
};

const EMPTY_DRAFT: PlanDraft = {
  essentialBills: '',
  everydaySpending: '',
  buffer: '',
};

const PLAN_ROWS: PlanRow[] = [
  {
    field: 'essentialBills',
    icon: Home,
    label: 'Essential bills',
    hint: 'The commitments you want to cover from this pay.',
    tone: 'violet',
  },
  {
    field: 'everydaySpending',
    icon: ShoppingBasket,
    label: 'Everyday spending',
    hint: 'The amount you want available for day-to-day costs.',
    tone: 'aqua',
  },
  {
    field: 'buffer',
    icon: PiggyBank,
    label: 'Build my buffer',
    hint: 'Anything you would like to put aside this payday.',
    tone: 'coral',
  },
];

function amountFromInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  const parsed = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function latestConfirmedPayslip(payslips: Payslip[]): Payslip | null {
  const confirmed = payslips.filter((payslip) => (
    payslip.status === 'confirmed'
    && payslip.net_pay > 0
    && Boolean(payslip.pay_date)
  ));

  return confirmed.reduce<Payslip | null>((latest, payslip) => {
    if (!latest) return payslip;
    return new Date(payslip.pay_date).getTime() > new Date(latest.pay_date).getTime() ? payslip : latest;
  }, null);
}

function PlanLoading() {
  return (
    <section className="payday-plan payday-plan--loading" aria-busy="true" aria-live="polite">
      <img className="payday-plan__aqua-corner" src={aquaCorner} alt="" aria-hidden="true" />
      <div className="payday-plan__loading-copy">
        <span className="payday-plan__loading-line payday-plan__loading-line--title" />
        <span className="payday-plan__loading-line payday-plan__loading-line--body" />
      </div>
      <div className="payday-plan__loading-amount" />
      <div className="payday-plan__loading-rows">
        {PLAN_ROWS.map((row) => <span className="payday-plan__loading-row" key={row.field} />)}
      </div>
      <span className="sr-only">Opening your payday plan…</span>
    </section>
  );
}

function PlanEmptyState({ hasPayslips, hasLoadError }: { hasPayslips: boolean; hasLoadError: boolean }) {
  const heading = hasLoadError
    ? 'Your plan needs a quick refresh.'
    : hasPayslips
      ? 'Confirm a payslip before you plan.'
      : 'Start with the pay you received.';
  const body = hasLoadError
    ? 'We could not load the payslip figures needed for a plan. Return to your payslip vault and try again.'
    : hasPayslips
      ? 'A confirmed payslip keeps your plan tied to the figures you have reviewed. Open your vault to finish that step.'
      : 'Once you have confirmed a payslip, you can use its take-home pay to make a simple payday plan.';

  return (
    <section className="payday-plan payday-plan--empty">
      <img className="payday-plan__aqua-corner" src={aquaCorner} alt="" aria-hidden="true" />
      <div className="payday-plan__empty-icon" aria-hidden="true"><FileText strokeWidth={1.8} /></div>
      <h1>{heading}</h1>
      <p>{body}</p>
      <div className="payday-plan__empty-actions">
        <Link className="payday-plan__primary-action" to="/vault">
          {hasPayslips ? 'Open my payslip vault' : 'Check a payslip'} <ArrowRight aria-hidden="true" />
        </Link>
        <Link className="payday-plan__text-action" to="/calculator">
          <Calculator aria-hidden="true" /> Use the pay calculator
        </Link>
      </div>
      <p className="payday-plan__empty-note">Payslip Insights is a planning tool, not financial, tax, or payroll advice.</p>
    </section>
  );
}

export function Plan() {
  const { data: payslips, isError, isLoading } = usePayslips();
  const { format: formatCurrency, symbol } = useCurrency();
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_DRAFT);

  const allPayslips = payslips ?? [];
  const latestPayslip = latestConfirmedPayslip(allPayslips);
  const amounts = Object.values(draft).map(amountFromInput);
  const hasInvalidAmount = amounts.some((amount) => amount === null);
  const allocated = amounts.reduce<number>((total, amount) => total + (amount ?? 0), 0);
  const netPay = latestPayslip?.net_pay ?? 0;
  const remaining = netPay - allocated;
  const isOverAllocated = remaining < 0;
  const hasDraftValue = Object.values(draft).some((value) => value.trim().length > 0);

  const updateDraft = (field: DraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const openSetup = () => setIsSetupOpen(true);
  const clearDraft = () => setDraft(EMPTY_DRAFT);

  return (
    <AppLayout>
      {isLoading ? <PlanLoading /> : !latestPayslip ? (
        <PlanEmptyState hasPayslips={allPayslips.length > 0} hasLoadError={isError} />
      ) : (
        <section className="payday-plan">
          <img className="payday-plan__aqua-corner" src={aquaCorner} alt="" aria-hidden="true" />

          <header className="payday-plan__hero">
            <div className="payday-plan__hero-copy">
              <h1>Plan until payday.</h1>
              <p>Start with the take-home pay you confirmed, then decide what you want to set aside.</p>
            </div>
            <div className="payday-plan__source">
              <CalendarDays aria-hidden="true" />
              <span>Confirmed on {formatDate(latestPayslip.pay_date)}</span>
            </div>
          </header>

          <section className="payday-plan__pay-summary" aria-labelledby="confirmed-pay-heading">
            <p id="confirmed-pay-heading">Confirmed take-home pay</p>
            <strong>{formatCurrency(netPay)}</strong>
            <span>{latestPayslip.employer_name === 'Unknown' ? 'Your latest confirmed payslip' : latestPayslip.employer_name}</span>
          </section>

          <section className="payday-plan__allocation" aria-labelledby="allocation-heading">
            <div className="payday-plan__section-heading">
              <div>
                <h2 id="allocation-heading">Give every pound a job.</h2>
                <p>Make a private working draft for this payday.</p>
              </div>
              {!isSetupOpen ? (
                <button className="payday-plan__setup-button" type="button" onClick={openSetup}>
                  Set up this payday <ArrowRight aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="payday-plan__rows">
              {PLAN_ROWS.map(({ field, icon: Icon, label, hint, tone }) => (
                <div className="payday-plan__row" key={field}>
                  <div className={`payday-plan__row-icon payday-plan__row-icon--${tone}`} aria-hidden="true">
                    <Icon strokeWidth={1.85} />
                  </div>
                  <div className="payday-plan__row-copy">
                    <label htmlFor={`plan-${field}`}>{label}</label>
                    <span>{hint}</span>
                  </div>
                  {isSetupOpen ? (
                    <div className="payday-plan__money-input">
                      <span aria-hidden="true">{symbol}</span>
                      <input
                        aria-describedby={`plan-${field}-hint`}
                        aria-label={`${label} amount`}
                        id={`plan-${field}`}
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => updateDraft(field, event.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={draft[field]}
                      />
                    </div>
                  ) : (
                    <button className="payday-plan__add-amount" type="button" onClick={openSetup}>
                      Add amount <ArrowRight aria-hidden="true" />
                    </button>
                  )}
                  <span className="sr-only" id={`plan-${field}-hint`}>{hint}</span>
                </div>
              ))}
            </div>

            {isSetupOpen ? (
              <div className={`payday-plan__outcome ${isOverAllocated || hasInvalidAmount ? 'payday-plan__outcome--warning' : ''}`} aria-live="polite">
                <div>
                  <p>{hasInvalidAmount ? 'Check an amount' : isOverAllocated ? 'Allocated over take-home pay' : 'Left to assign'}</p>
                  <strong>{formatCurrency(Math.abs(remaining))}</strong>
                </div>
                <WalletCards aria-hidden="true" strokeWidth={1.7} />
              </div>
            ) : null}

            {isSetupOpen ? (
              <div className="payday-plan__draft-note">
                <CircleAlert aria-hidden="true" strokeWidth={1.8} />
                <p>
                  {hasDraftValue
                    ? 'This is a private working draft. It is not saved to your account or used to move money.'
                    : 'Add the amounts you want to think through. This first web version keeps the draft on this page only.'}
                </p>
              </div>
            ) : null}
          </section>

          {isSetupOpen ? (
            <footer className="payday-plan__actions">
              <Link className="payday-plan__primary-action" to="/calculator">
                Check figures in the calculator <Calculator aria-hidden="true" />
              </Link>
              <button className="payday-plan__clear-button" type="button" onClick={clearDraft}>Clear this draft</button>
            </footer>
          ) : null}

          <p className="payday-plan__disclaimer">This is a personal planning aid. It does not provide financial, tax, or payroll advice.</p>
        </section>
      )}
    </AppLayout>
  );
}

export default Plan;
