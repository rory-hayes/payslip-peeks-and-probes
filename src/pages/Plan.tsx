import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  CalendarDays,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  CircleAlert,
  FileText,
  Home,
  LoaderCircle,
  PiggyBank,
  ShoppingBasket,
  WalletCards,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import {
  useActivePaydayPlan,
  useSavePaydayCheckIn,
  useSavePaydayPlan,
  type PaydayCheckIn,
  type PaydayPlan,
  type PaydayPlanAllocationKey,
  type PaydayPlanAllocations,
} from '@/hooks/use-payday-plan';
import { usePrimaryBufferGoal, useSavePrimaryBufferGoal, type BufferGoal } from '@/hooks/use-buffer-goal';
import { usePayslips } from '@/hooks/use-payslip-data';
import { useProfile } from '@/hooks/use-profile';
import { formatDate } from '@/lib/date-utils';
import { addDaysToIsoDate, calendarDaysUntilIsoDate, everydaySpendingGuide, inferNextPayday, isIsoDateAfter, isValidIsoDate } from '@/lib/payday-plan-utils';
import type { Payslip } from '@/lib/types';
import aquaCorner from '@/assets/option-one-aqua-corner-v2.webp';
import './Plan.css';

type DraftField = PaydayPlanAllocationKey;

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

const EMPTY_PAYSLIPS: Payslip[] = [];

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
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function draftFromAllocations(allocations: PaydayPlanAllocations): PlanDraft {
  return {
    essentialBills: allocations.essentialBills ? String(allocations.essentialBills) : '',
    everydaySpending: allocations.everydaySpending ? String(allocations.everydaySpending) : '',
    buffer: allocations.buffer ? String(allocations.buffer) : '',
  };
}

function draftToAllocations(draft: PlanDraft): PaydayPlanAllocations {
  return {
    essentialBills: amountFromInput(draft.essentialBills) ?? 0,
    everydaySpending: amountFromInput(draft.everydaySpending) ?? 0,
    buffer: amountFromInput(draft.buffer) ?? 0,
  };
}

function latestConfirmedPayslip(payslips: Payslip[]): Payslip | null {
  const confirmed = payslips.filter((payslip) => (
    payslip.status === 'confirmed'
    && payslip.net_pay > 0
    && isValidIsoDate(payslip.pay_date)
  ));

  return confirmed.reduce<Payslip | null>((latest, payslip) => {
    if (!latest) return payslip;
    return isIsoDateAfter(payslip.pay_date, latest.pay_date) ? payslip : latest;
  }, null);
}

function latestPayslipReadyToReview(payslips: Payslip[]): Payslip | null {
  return payslips
    .filter((payslip) => payslip.status === 'extracted')
    .reduce<Payslip | null>((latest, payslip) => {
      if (!latest) return payslip;
      if (!isValidIsoDate(payslip.pay_date)) return latest;
      if (!isValidIsoDate(latest.pay_date)) return payslip;
      return isIsoDateAfter(payslip.pay_date, latest.pay_date) ? payslip : latest;
    }, null);
}

function getPlanForPayslip(plan: PaydayPlan | null | undefined, payslip: Payslip | null): PaydayPlan | null {
  if (!plan || !payslip) return null;
  return plan.payslipId === payslip.id && plan.payDate === payslip.pay_date ? plan : null;
}

function currencyForPayslip(payslip: Payslip): 'GBP' | 'EUR' {
  return payslip.country === 'Ireland' ? 'EUR' : 'GBP';
}

function formatPlanCurrency(amount: number, currency: 'GBP' | 'EUR'): string {
  return new Intl.NumberFormat(currency === 'EUR' ? 'en-IE' : 'en-GB', {
    currency,
    style: 'currency',
  }).format(amount);
}

function planSaveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('next payday')) return 'Choose a next payday after the confirmed pay date.';
  if (message.includes('allocations cannot exceed')) return 'Your planned amounts cannot be more than your confirmed take-home pay.';
  if (message.includes('confirmed payslip')) return 'Choose a payslip you have confirmed before saving a plan.';
  if (message.includes('Authentication')) return 'Sign in again before saving your plan.';
  return 'We could not save your payday plan. Your entries are still here, so please try again.';
}

function bufferGoalSaveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('target')) return 'Choose a buffer target greater than zero.';
  if (message.includes('set aside')) return 'Check the amount you have already set aside.';
  if (message.includes('Sign in') || message.includes('Authentication')) return 'Sign in again before saving your buffer goal.';
  return 'We could not save your buffer goal. Your entries are still here, so please try again.';
}

function paydayCheckInSaveErrorMessage(
  error: unknown,
  plannedEveryday: number,
  currency: 'GBP' | 'EUR',
): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('cannot exceed')) {
    return `Keep this at or below the ${formatPlanCurrency(plannedEveryday, currency)} you planned for everyday spending.`;
  }
  if (message.includes('next payday')) return 'Update your next payday before saving a check-in.';
  if (message.includes('everyday-spending amount')) return 'Add an everyday-spending amount to this plan before checking in.';
  if (message.includes('Sign in') || message.includes('Authentication')) return 'Sign in again before saving your check-in.';
  return 'We could not save your payday check-in. Your amount is still here, so please try again.';
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

function PlanEmptyState({
  hasPayslips,
  hasLoadError,
  payslipReadyToReview,
}: {
  hasPayslips: boolean;
  hasLoadError: boolean;
  payslipReadyToReview: Payslip | null;
}) {
  const heading = hasLoadError
    ? 'Your plan needs a quick refresh.'
    : payslipReadyToReview
      ? 'Your payslip is ready to review.'
    : hasPayslips
      ? 'Confirm a payslip before you plan.'
      : 'Start with the pay you received.';
  const body = hasLoadError
    ? 'We could not load the payslip figures needed for a plan. Return to your payslip vault and try again.'
    : payslipReadyToReview
      ? 'Check the extracted figures before you confirm this payslip and use it to make your payday plan.'
    : hasPayslips
      ? 'A confirmed payslip keeps your plan tied to the figures you have reviewed. Open your vault to finish that step.'
      : 'Once you have confirmed a payslip, you can use its take-home pay to make a simple payday plan.';
  const primaryAction = payslipReadyToReview
    ? { label: 'Review my payslip', to: `/vault?review=${encodeURIComponent(payslipReadyToReview.id)}` }
    : { label: hasPayslips ? 'Open my payslip vault' : 'Check a payslip', to: '/vault' };

  return (
    <section className="payday-plan payday-plan--empty">
      <img className="payday-plan__aqua-corner" src={aquaCorner} alt="" aria-hidden="true" />
      <div className="payday-plan__empty-icon" aria-hidden="true"><FileText strokeWidth={1.8} /></div>
      <h1>{heading}</h1>
      <p>{body}</p>
      <div className="payday-plan__empty-actions">
        <Link className="payday-plan__primary-action" to={primaryAction.to}>
          {primaryAction.label} <ArrowRight aria-hidden="true" />
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
  const { data: payslips, isError: isPayslipError, isLoading: isPayslipLoading } = usePayslips();
  const { data: activePlan, isError: isPlanError, isLoading: isPlanLoading } = useActivePaydayPlan();
  const { data: profile } = useProfile();
  const {
    data: bufferGoalFromServer,
    isError: isBufferGoalError,
    isLoading: isBufferGoalLoading,
  } = usePrimaryBufferGoal();
  const savePlan = useSavePaydayPlan();
  const savePaydayCheckIn = useSavePaydayCheckIn();
  const saveBufferGoal = useSavePrimaryBufferGoal();
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isPaydayCheckInOpen, setIsPaydayCheckInOpen] = useState(false);
  const [isBufferGoalSetupOpen, setIsBufferGoalSetupOpen] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>(EMPTY_DRAFT);
  const [nextPayday, setNextPayday] = useState('');
  const [localSavedPlan, setLocalSavedPlan] = useState<PaydayPlan | null>(null);
  const [localPaydayCheckIn, setLocalPaydayCheckIn] = useState<PaydayCheckIn | null>(null);
  const [localBufferGoal, setLocalBufferGoal] = useState<BufferGoal | null>(null);
  const [everydayRemaining, setEverydayRemaining] = useState('');
  const [bufferTarget, setBufferTarget] = useState('');
  const [bufferCurrent, setBufferCurrent] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [paydayCheckInMessage, setPaydayCheckInMessage] = useState('');
  const [paydayCheckInError, setPaydayCheckInError] = useState('');
  const [bufferGoalMessage, setBufferGoalMessage] = useState('');
  const [bufferGoalError, setBufferGoalError] = useState('');

  const allPayslips = payslips ?? EMPTY_PAYSLIPS;
  const latestPayslip = latestConfirmedPayslip(allPayslips);
  const payslipReadyToReview = latestPayslipReadyToReview(allPayslips);
  const planFromServer = getPlanForPayslip(activePlan, latestPayslip);
  const planFromSave = getPlanForPayslip(localSavedPlan, latestPayslip);
  const savedPlan = planFromSave ?? planFromServer;
  const savedPaydayCheckIn = savedPlan && localPaydayCheckIn?.planId === savedPlan.id
    ? localPaydayCheckIn
    : savedPlan && savedPlan.everydayRemaining !== null && savedPlan.everydayCheckedInAt
      ? {
          planId: savedPlan.id,
          everydayRemaining: savedPlan.everydayRemaining,
          checkedInAt: savedPlan.everydayCheckedInAt,
        }
      : null;
  const bufferGoal = localBufferGoal ?? bufferGoalFromServer;
  const amounts = Object.values(draft).map(amountFromInput);
  const hasInvalidAmount = amounts.some((amount) => amount === null);
  const allocations = draftToAllocations(draft);
  const allocated = Object.values(allocations).reduce((total, amount) => total + amount, 0);
  const netPay = latestPayslip?.net_pay ?? 0;
  const remaining = netPay - allocated;
  const isOverAllocated = remaining < 0;
  const hasDraftValue = Object.values(draft).some((value) => value.trim().length > 0);
  const minimumNextPayday = latestPayslip
    ? addDaysToIsoDate(latestPayslip.pay_date, 1)
    : '';
  const isNextPaydayValid = Boolean(
    latestPayslip
    && isValidIsoDate(nextPayday)
    && isIsoDateAfter(nextPayday, latestPayslip.pay_date),
  );
  const planCurrency = latestPayslip ? currencyForPayslip(latestPayslip) : 'GBP';
  const planSymbol = planCurrency === 'EUR' ? '€' : '£';
  const formatCurrency = (amount: number) => formatPlanCurrency(amount, planCurrency);
  const canSave = hasDraftValue && !hasInvalidAmount && !isOverAllocated && isNextPaydayValid && !savePlan.isPending;

  const suggestedNextPayday = latestPayslip ? inferNextPayday(latestPayslip, allPayslips, undefined, profile?.pay_frequency) : '';
  const guideEverydaySpending = isSetupOpen
    ? allocations.everydaySpending
    : savedPlan?.allocations.everydaySpending ?? 0;
  const guideNextPayday = isSetupOpen ? nextPayday : savedPlan?.nextPayday ?? '';
  const guideDays = calendarDaysUntilIsoDate(guideNextPayday);
  const dailyGuide = everydaySpendingGuide(guideEverydaySpending, guideNextPayday);
  const checkInEverydayAmount = savedPlan?.allocations.everydaySpending ?? 0;
  const checkInRemainingAmount = amountFromInput(everydayRemaining);
  const checkInGuide = savedPaydayCheckIn
    ? everydaySpendingGuide(savedPaydayCheckIn.everydayRemaining, savedPlan?.nextPayday ?? '')
    : null;
  const checkInDays = savedPlan ? calendarDaysUntilIsoDate(savedPlan.nextPayday) : null;
  const canUsePaydayCheckIn = Boolean(
    savedPlan
    && checkInEverydayAmount > 0
    && checkInDays !== null
    && checkInDays > 0,
  );
  const canSavePaydayCheckIn = Boolean(
    canUsePaydayCheckIn
    && everydayRemaining.trim().length > 0
    && checkInRemainingAmount !== null
    && checkInRemainingAmount >= 0
    && checkInRemainingAmount <= checkInEverydayAmount
    && !savePaydayCheckIn.isPending,
  );
  const bufferTargetAmount = amountFromInput(bufferTarget);
  const bufferCurrentAmount = amountFromInput(bufferCurrent);
  const canSaveBufferGoal = Boolean(
    bufferTargetAmount !== null
    && bufferTargetAmount > 0
    && bufferCurrentAmount !== null
    && bufferCurrentAmount >= 0
    && !saveBufferGoal.isPending,
  );
  const bufferProgress = bufferGoal && bufferGoal.targetAmount > 0
    ? Math.min(100, Math.max(0, (bufferGoal.currentAmount / bufferGoal.targetAmount) * 100))
    : 0;
  const formatBufferCurrency = (amount: number) => formatPlanCurrency(amount, bufferGoal?.currency ?? planCurrency);

  const updateDraft = (field: DraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaveError('');
  };

  const openSetup = () => {
    if (!latestPayslip) return;
    setDraft(savedPlan ? draftFromAllocations(savedPlan.allocations) : EMPTY_DRAFT);
    setNextPayday(savedPlan?.nextPayday ?? suggestedNextPayday);
    setSaveMessage('');
    setSaveError('');
    setIsSetupOpen(true);
  };

  const openBufferGoalSetup = () => {
    setBufferTarget(bufferGoal ? String(bufferGoal.targetAmount) : '');
    setBufferCurrent(bufferGoal ? String(bufferGoal.currentAmount) : '');
    setBufferGoalMessage('');
    setBufferGoalError('');
    setIsBufferGoalSetupOpen(true);
  };

  const openPaydayCheckIn = () => {
    if (!savedPlan || !canUsePaydayCheckIn) return;
    setEverydayRemaining(savedPaydayCheckIn ? String(savedPaydayCheckIn.everydayRemaining) : '');
    setPaydayCheckInMessage('');
    setPaydayCheckInError('');
    setIsPaydayCheckInOpen(true);
  };

  const closePaydayCheckIn = () => {
    if (savePaydayCheckIn.isPending) return;
    setIsPaydayCheckInOpen(false);
    setPaydayCheckInError('');
  };

  const closeBufferGoalSetup = () => {
    if (saveBufferGoal.isPending) return;
    setIsBufferGoalSetupOpen(false);
    setBufferGoalError('');
  };

  const clearDraft = () => {
    setDraft(EMPTY_DRAFT);
    setSaveMessage('');
    setSaveError('');
  };

  const handleSave = () => {
    if (!latestPayslip || !canSave) return;

    setSaveMessage('');
    setSaveError('');
    savePlan.mutate({
      payslipId: latestPayslip.id,
      nextPayday,
      allocations,
    }, {
      onSuccess: (plan) => {
        setLocalSavedPlan(plan);
        setLocalPaydayCheckIn(null);
        setIsPaydayCheckInOpen(false);
        setIsSetupOpen(false);
        setSaveMessage(`Saved for this pay cycle through ${formatDate(plan.nextPayday)}. You can update it any time.`);
      },
      onError: (error) => setSaveError(planSaveErrorMessage(error)),
    });
  };

  const handleSaveBufferGoal = () => {
    if (!canSaveBufferGoal || bufferTargetAmount === null || bufferCurrentAmount === null) return;

    setBufferGoalMessage('');
    setBufferGoalError('');
    saveBufferGoal.mutate({
      currency: planCurrency,
      currentAmount: bufferCurrentAmount,
      targetAmount: bufferTargetAmount,
    }, {
      onSuccess: (goal) => {
        setLocalBufferGoal(goal);
        setIsBufferGoalSetupOpen(false);
        setBufferGoalMessage('Your one-payday buffer goal is saved.');
      },
      onError: (error) => setBufferGoalError(bufferGoalSaveErrorMessage(error)),
    });
  };

  const handleSavePaydayCheckIn = () => {
    if (!savedPlan || !canSavePaydayCheckIn || checkInRemainingAmount === null) return;

    setPaydayCheckInMessage('');
    setPaydayCheckInError('');
    savePaydayCheckIn.mutate({
      planId: savedPlan.id,
      everydayRemaining: checkInRemainingAmount,
    }, {
      onSuccess: (checkIn) => {
        setLocalPaydayCheckIn(checkIn);
        setIsPaydayCheckInOpen(false);
        setPaydayCheckInMessage('Your payday check-in is saved.');
      },
      onError: (error) => setPaydayCheckInError(paydayCheckInSaveErrorMessage(error, checkInEverydayAmount, planCurrency)),
    });
  };

  return (
    <AppLayout>
      {isPayslipLoading || isPlanLoading ? <PlanLoading /> : !latestPayslip ? (
        <PlanEmptyState
          hasPayslips={allPayslips.length > 0}
          hasLoadError={isPayslipError}
          payslipReadyToReview={payslipReadyToReview}
        />
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

          {payslipReadyToReview ? (
            <aside className="payday-plan__review-ready" aria-label="Payslip ready to review">
              <div>
                <strong>Your newest payslip is ready to review.</strong>
                <p>Confirm its figures before using it for your next payday plan.</p>
              </div>
              <Link to={`/vault?review=${encodeURIComponent(payslipReadyToReview.id)}`}>
                Review my payslip <ArrowRight aria-hidden="true" />
              </Link>
            </aside>
          ) : null}

          <section className="payday-plan__pay-summary" aria-labelledby="confirmed-pay-heading">
            <p id="confirmed-pay-heading">Confirmed take-home pay</p>
            <strong>{formatCurrency(netPay)}</strong>
            <span>{latestPayslip.employer_name === 'Unknown' ? 'Your latest confirmed payslip' : latestPayslip.employer_name}</span>
          </section>

          <section className="payday-plan__allocation" aria-labelledby="allocation-heading">
            <div className="payday-plan__section-heading">
              <div>
                <h2 id="allocation-heading">Give your pay a job.</h2>
                <p>
                  {savedPlan
                    ? checkInDays !== null && checkInDays <= 0
                      ? `That pay cycle ended ${formatDate(savedPlan.nextPayday)}. Update your plan with your next payday before adding another check-in.`
                      : `Saved for the pay cycle ending ${formatDate(savedPlan.nextPayday)}.`
                    : 'Set aside what matters until your next payday.'}
                </p>
              </div>
              {!isSetupOpen ? (
                <button className="payday-plan__setup-button" type="button" onClick={openSetup}>
                  {savedPlan ? 'Edit this payday' : 'Set up this payday'} <ArrowRight aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {isPlanError ? (
              <p className="payday-plan__form-alert" role="alert">We could not load a saved plan. You can still make a new plan from this confirmed payslip.</p>
            ) : null}

            {saveMessage ? (
              <div className="payday-plan__saved-status" role="status">
                <CheckCircle2 aria-hidden="true" strokeWidth={2} />
                <p>{saveMessage}</p>
              </div>
            ) : null}

            {isSetupOpen ? (
              <div className="payday-plan__date-field">
                <div>
                  <label htmlFor="next-payday">Next payday</label>
                  <p>We suggested this from your payslip history or the pay rhythm in your profile. Check it against your expected payday.</p>
                </div>
                <input
                  id="next-payday"
                  min={minimumNextPayday}
                  onChange={(event) => {
                    setNextPayday(event.target.value);
                    setSaveError('');
                  }}
                  type="date"
                  value={nextPayday}
                />
              </div>
            ) : null}

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
                      <span aria-hidden="true">{planSymbol}</span>
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
                  ) : savedPlan ? (
                    <button className="payday-plan__saved-amount" type="button" onClick={openSetup} aria-label={`Edit ${label}`}>
                      {formatCurrency(savedPlan.allocations[field])}
                    </button>
                  ) : (
                    <button className="payday-plan__add-amount" type="button" onClick={openSetup}>
                      Add amount <ArrowRight aria-hidden="true" />
                    </button>
                  )}
                  <span className="sr-only" id={`plan-${field}-hint`}>{hint}</span>
                </div>
              ))}
            </div>

            {guideEverydaySpending > 0 && dailyGuide !== null && guideDays !== null && guideDays > 0 ? (
              <section className="payday-plan__daily-guide" aria-labelledby="everyday-guide-heading">
                <div>
                  <p id="everyday-guide-heading">Everyday spending guide</p>
                  <strong>{formatCurrency(dailyGuide)} <span>/ day</span></strong>
                </div>
                <p>{formatCurrency(guideEverydaySpending)} set aside across {guideDays} {guideDays === 1 ? 'day' : 'days'} until payday. This is a planning guide, not your bank balance.</p>
              </section>
            ) : null}

            {isSetupOpen ? (
              <>
                <div className={`payday-plan__outcome ${isOverAllocated || hasInvalidAmount || !isNextPaydayValid ? 'payday-plan__outcome--warning' : ''}`} aria-live="polite">
                  <div>
                    <p>{hasInvalidAmount ? 'Check an amount' : !isNextPaydayValid ? 'Check your next payday' : isOverAllocated ? 'Allocated over take-home pay' : hasDraftValue ? 'Left to assign' : 'Add an amount to save'}</p>
                    <strong>{hasInvalidAmount || !hasDraftValue ? '—' : formatCurrency(Math.abs(remaining))}</strong>
                  </div>
                  <WalletCards aria-hidden="true" strokeWidth={1.7} />
                </div>

                {saveError ? <p className="payday-plan__form-alert" role="alert">{saveError}</p> : null}

                <div className="payday-plan__draft-note">
                  <CircleAlert aria-hidden="true" strokeWidth={1.8} />
                  <p>Saving keeps this plan in your account. It does not access a bank, move money, or replace checking your original payslip.</p>
                </div>
              </>
            ) : null}
          </section>

          {canUsePaydayCheckIn ? (
            <section className="payday-plan__check-in" id="payday-check-in" tabIndex={-1} aria-labelledby="payday-check-in-heading">
              <div className="payday-plan__section-heading">
                <div>
                  <h2 id="payday-check-in-heading">A quick payday check-in.</h2>
                  <p>Keep a manual note of the everyday money left in this plan. It is a planning check, not a bank balance.</p>
                </div>
                {!isPaydayCheckInOpen ? (
                  <button className="payday-plan__setup-button" type="button" onClick={openPaydayCheckIn}>
                    {savedPaydayCheckIn ? 'Update check-in' : 'Add a check-in'} <ArrowRight aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              {paydayCheckInMessage ? (
                <div className="payday-plan__saved-status" role="status">
                  <CheckCircle2 aria-hidden="true" strokeWidth={2} />
                  <p>{paydayCheckInMessage}</p>
                </div>
              ) : null}

              {savedPaydayCheckIn ? (
                <div className="payday-plan__check-in-summary">
                  <div>
                    <p>Everyday money left</p>
                    <strong>{formatCurrency(savedPaydayCheckIn.everydayRemaining)} <span>of {formatCurrency(checkInEverydayAmount)}</span></strong>
                  </div>
                  <p>
                    {checkInGuide !== null && checkInDays !== null && checkInDays > 0
                      ? `${formatCurrency(checkInGuide)} a day across ${checkInDays} ${checkInDays === 1 ? 'day' : 'days'} until ${formatDate(savedPlan.nextPayday)}. This is a planning guide, not a live balance.`
                      : 'Your check-in is saved. Update your next payday before using a daily planning guide.'}
                  </p>
                </div>
              ) : !isPaydayCheckInOpen ? (
                <div className="payday-plan__check-in-empty">
                  <ClipboardCheck aria-hidden="true" strokeWidth={1.8} />
                  <p>You planned {formatCurrency(checkInEverydayAmount)} for everyday spending. Add a check-in whenever you want a calmer view of the days ahead.</p>
                </div>
              ) : null}

              {isPaydayCheckInOpen ? (
                <div className="payday-plan__check-in-form">
                  <label className="payday-plan__buffer-input" htmlFor="everyday-remaining">
                    <span>Everyday money left</span>
                    <div>
                      <span aria-hidden="true">{planSymbol}</span>
                      <input
                        aria-describedby="everyday-remaining-help"
                        aria-label="Everyday money left"
                        id="everyday-remaining"
                        inputMode="decimal"
                        min="0"
                        max={checkInEverydayAmount}
                        onChange={(event) => {
                          setEverydayRemaining(event.target.value);
                          setPaydayCheckInError('');
                        }}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={everydayRemaining}
                      />
                    </div>
                  </label>
                  <span className="sr-only" id="everyday-remaining-help">Enter an amount between zero and {formatCurrency(checkInEverydayAmount)} from this plan.</span>
                  <p className="payday-plan__check-in-help">You planned {formatCurrency(checkInEverydayAmount)} for everyday spending. Enter only the amount left from that plan.</p>
                  {paydayCheckInError ? <p className="payday-plan__form-alert" role="alert">{paydayCheckInError}</p> : null}
                  <div className="payday-plan__buffer-actions">
                    <button className="payday-plan__primary-action" disabled={!canSavePaydayCheckIn} type="button" onClick={handleSavePaydayCheckIn}>
                      {savePaydayCheckIn.isPending ? <LoaderCircle className="payday-plan__save-spinner" aria-hidden="true" /> : null}
                      {savePaydayCheckIn.isPending ? 'Saving your check-in…' : savedPaydayCheckIn ? 'Update check-in' : 'Save check-in'}
                    </button>
                    <button className="payday-plan__clear-button" disabled={savePaydayCheckIn.isPending} type="button" onClick={closePaydayCheckIn}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="payday-plan__buffer-goal" aria-labelledby="buffer-goal-heading">
            <div className="payday-plan__section-heading">
              <div>
                <h2 id="buffer-goal-heading">One-payday buffer.</h2>
                <p>Set the amount that would cover one ordinary pay period of essentials, then keep a simple record of what you have set aside.</p>
              </div>
              {!isBufferGoalSetupOpen && !isBufferGoalLoading ? (
                <button className="payday-plan__setup-button" type="button" onClick={openBufferGoalSetup}>
                  {bufferGoal ? 'Update buffer goal' : 'Set a buffer goal'} <ArrowRight aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {isBufferGoalError ? (
              <p className="payday-plan__form-alert" role="alert">We could not load your saved buffer goal. You can still add or update it below.</p>
            ) : null}

            {bufferGoalMessage ? (
              <div className="payday-plan__saved-status" role="status">
                <CheckCircle2 aria-hidden="true" strokeWidth={2} />
                <p>{bufferGoalMessage}</p>
              </div>
            ) : null}

            {isBufferGoalLoading && !localBufferGoal ? (
              <div className="payday-plan__buffer-loading" aria-busy="true" aria-live="polite">
                <p>Loading your saved buffer goal…</p>
              </div>
            ) : bufferGoal ? (
              <div className="payday-plan__buffer-progress">
                <div className="payday-plan__buffer-progress-copy">
                  <p>Already set aside</p>
                  <strong>{formatBufferCurrency(bufferGoal.currentAmount)} <span>of {formatBufferCurrency(bufferGoal.targetAmount)}</span></strong>
                </div>
                <div
                  aria-label={`Buffer progress: ${formatBufferCurrency(bufferGoal.currentAmount)} of ${formatBufferCurrency(bufferGoal.targetAmount)}`}
                  aria-valuemax={bufferGoal.targetAmount}
                  aria-valuemin={0}
                  aria-valuenow={Math.min(bufferGoal.currentAmount, bufferGoal.targetAmount)}
                  className="payday-plan__buffer-progress-track"
                  role="progressbar"
                >
                  <span style={{ width: `${bufferProgress}%` }} />
                </div>
                <p className="payday-plan__buffer-progress-note">
                  {bufferGoal.currentAmount >= bufferGoal.targetAmount
                    ? 'Your target is covered. Keep it under review as your regular costs change.'
                    : 'This is a manual progress check. It does not read or move money in your accounts.'}
                </p>
              </div>
            ) : !isBufferGoalSetupOpen ? (
              <div className="payday-plan__buffer-empty">
                <PiggyBank aria-hidden="true" strokeWidth={1.8} />
                <p>A small cushion can make the next payday feel less fragile. Start with one ordinary pay period of essentials.</p>
              </div>
            ) : null}

            {isBufferGoalSetupOpen ? (
              <div className="payday-plan__buffer-form">
                <div className="payday-plan__buffer-fields">
                  <label className="payday-plan__buffer-input" htmlFor="buffer-target">
                    <span>Buffer target</span>
                    <div>
                      <span aria-hidden="true">{planSymbol}</span>
                      <input
                        aria-label="Buffer target"
                        aria-describedby="buffer-target-help"
                        id="buffer-target"
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => {
                          setBufferTarget(event.target.value);
                          setBufferGoalError('');
                        }}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={bufferTarget}
                      />
                    </div>
                  </label>
                  <label className="payday-plan__buffer-input" htmlFor="buffer-current">
                    <span>Already set aside</span>
                    <div>
                      <span aria-hidden="true">{planSymbol}</span>
                      <input
                        aria-label="Already set aside"
                        aria-describedby="buffer-current-help"
                        id="buffer-current"
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => {
                          setBufferCurrent(event.target.value);
                          setBufferGoalError('');
                        }}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={bufferCurrent}
                      />
                    </div>
                  </label>
                </div>
                <span className="sr-only" id="buffer-target-help">The amount you want your one-payday buffer to cover.</span>
                <span className="sr-only" id="buffer-current-help">The amount you have manually set aside so far.</span>

                {bufferGoalError ? <p className="payday-plan__form-alert" role="alert">{bufferGoalError}</p> : null}

                <div className="payday-plan__buffer-actions">
                  <button className="payday-plan__primary-action" disabled={!canSaveBufferGoal} type="button" onClick={handleSaveBufferGoal}>
                    {saveBufferGoal.isPending ? <LoaderCircle className="payday-plan__save-spinner" aria-hidden="true" /> : null}
                    {saveBufferGoal.isPending ? 'Saving your buffer…' : bufferGoal ? 'Update buffer goal' : 'Save buffer goal'}
                  </button>
                  <button className="payday-plan__clear-button" disabled={saveBufferGoal.isPending} type="button" onClick={closeBufferGoalSetup}>Cancel</button>
                </div>
              </div>
            ) : null}
          </section>

          {isSetupOpen ? (
            <footer className="payday-plan__actions">
              <button className="payday-plan__primary-action" disabled={!canSave} type="button" onClick={handleSave}>
                {savePlan.isPending ? <LoaderCircle className="payday-plan__save-spinner" aria-hidden="true" /> : null}
                {savePlan.isPending ? 'Saving your plan…' : 'Save this payday plan'}
              </button>
              <div className="payday-plan__secondary-actions">
                <button className="payday-plan__clear-button" disabled={savePlan.isPending} type="button" onClick={clearDraft}>Clear allocations</button>
                <Link className="payday-plan__text-action" to="/calculator">
                  <Calculator aria-hidden="true" /> Check figures in the calculator
                </Link>
              </div>
            </footer>
          ) : null}

          <p className="payday-plan__disclaimer">This is a personal planning aid. It does not provide financial, tax, or payroll advice.</p>
        </section>
      )}
    </AppLayout>
  );
}

export default Plan;
