import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, CheckCircle2, ExternalLink, FileCheck2, Landmark, ShieldCheck } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { usePayslips } from '@/hooks/use-payslip-data';
import { useProfile } from '@/hooks/use-profile';
import { useAuth } from '@/contexts/AuthContext';
import { useDemo } from '@/contexts/DemoContext';
import { DEMO_PAYSLIPS } from '@/lib/demo-data';
import {
  isDateInTaxYear,
  OFFICIAL_TAX_STEPS,
  taxYearWindow,
  type OfficialTaxStep,
  type TaxHelperCountry,
} from '@/lib/tax-helper';
import {
  browserTaxReviewProgressStorage,
  readTaxReviewProgress,
  writeTaxReviewProgress,
} from '@/lib/tax-review-progress';
import './TaxHelper.css';

function countryFromProfile(country: string | null | undefined): TaxHelperCountry {
  return country === 'Ireland' ? 'Ireland' : 'UK';
}

function TaxChecklist({
  country,
  historyPath,
  steps,
  taxYearLabel,
  userId,
}: {
  country: TaxHelperCountry;
  historyPath: string;
  steps: OfficialTaxStep[];
  taxYearLabel: string;
  userId: string | null;
}) {
  const validStepIds = useMemo(() => steps.map((step) => step.id), [steps]);
  const initialProgress = useMemo(() => (
    userId
      ? readTaxReviewProgress(
        browserTaxReviewProgressStorage(),
        userId,
        country,
        taxYearLabel,
        validStepIds,
      )
      : { available: false, reviewedStepIds: [] }
  ), [country, taxYearLabel, userId, validStepIds]);
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(initialProgress.reviewedStepIds),
  );
  const [canPersist, setCanPersist] = useState(initialProgress.available);
  const completedCount = steps.filter((step) => completed.has(step.id)).length;

  const toggleStep = (id: string) => {
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCompleted(next);

    if (userId) {
      setCanPersist(writeTaxReviewProgress(
        browserTaxReviewProgressStorage(),
        userId,
        country,
        taxYearLabel,
        [...next],
        validStepIds,
      ));
    }
  };

  const persistenceMessage = userId
    ? canPersist
      ? 'Saved on this browser'
      : 'Progress is not being saved on this browser'
    : 'Sample progress resets when you leave';

  return (
    <section className="tax-helper__steps" aria-labelledby="tax-steps-heading">
      <div className="tax-helper__section-heading">
        <div>
          <p className="tax-helper__eyebrow">Official-source checklist</p>
          <h2 id="tax-steps-heading">Your {taxYearLabel} review</h2>
        </div>
        <div className="tax-helper__progress-copy">
          <span>{completedCount} of {steps.length} reviewed</span>
          <small
            aria-live="polite"
            className={!userId ? 'is-neutral' : canPersist ? undefined : 'is-error'}
          >
            {persistenceMessage}
          </small>
        </div>
      </div>

      <div className="tax-helper__progress" aria-label={`${completedCount} of ${steps.length} steps reviewed`} role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={completedCount}>
        <span style={{ width: `${(completedCount / steps.length) * 100}%` }} />
      </div>

      <ol className="tax-helper__step-list">
        {steps.map((step, index) => {
          const checked = completed.has(step.id);
          const external = step.href.startsWith('http');
          return (
            <li className={checked ? 'is-complete' : ''} key={step.id}>
              <button
                aria-label={`${checked ? 'Mark as not reviewed' : 'Mark as reviewed'}: ${step.title}`}
                aria-pressed={checked}
                className="tax-helper__check"
                onClick={() => toggleStep(step.id)}
                type="button"
              >
                {checked ? <Check aria-hidden="true" /> : <span>{index + 1}</span>}
              </button>
              <div className="tax-helper__step-copy">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                {external ? (
                  <a href={step.href} rel="noreferrer" target="_blank">{step.action} <ExternalLink aria-hidden="true" /></a>
                ) : (
                  <Link to={step.href === '/vault' ? historyPath : step.href}>{step.action} <ArrowRight aria-hidden="true" /></Link>
                )}
              </div>
              <span className="tax-helper__source"><Landmark aria-hidden="true" /> {step.source}</span>
            </li>
          );
        })}
      </ol>

      {completedCount === steps.length ? (
        <div className="tax-helper__complete" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <h3>Your {taxYearLabel} checklist is reviewed.</h3>
            <p>Keep any official calculation, submission or response with the payslips and documents you used.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const TaxHelper = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: payslips, isError, isLoading } = usePayslips();
  const { isDemo } = useDemo();
  const [manualCountry, setManualCountry] = useState<TaxHelperCountry | null>(null);
  const [period, setPeriod] = useState<'completed' | 'current'>('completed');
  const country = manualCountry ?? countryFromProfile(profile?.country);
  const window = useMemo(() => taxYearWindow(country, new Date(), period === 'completed' ? -1 : 0), [country, period]);
  const steps = OFFICIAL_TAX_STEPS[country];
  const availablePayslips = isDemo ? DEMO_PAYSLIPS : (payslips ?? []);
  const confirmedThisYear = availablePayslips.filter(
    (payslip) => payslip.status === 'confirmed' && payslip.country === country && isDateInTaxYear(payslip.pay_date, window),
  );
  const historyPath = isDemo ? '/dashboard#pay-history-heading' : '/vault';

  return (
    <AppLayout>
      <div className="tax-helper">
        <header className="tax-helper__hero">
          <div>
            <p className="tax-helper__eyebrow">Tax year</p>
            <h1>Your tax year, organised.</h1>
            <p className="tax-helper__intro">
              Bring your confirmed payslips together, then follow the official steps for {country === 'Ireland' ? 'Revenue' : 'HMRC'}. We guide the review; the official service makes the decision.
            </p>
          </div>
          <div className="tax-helper__shield" aria-hidden="true"><ShieldCheck /></div>
        </header>

        <div className="tax-helper__controls">
          <div className="tax-helper__country" role="group" aria-label="Choose tax country">
            <button aria-pressed={country === 'Ireland'} onClick={() => setManualCountry('Ireland')} type="button">Ireland</button>
            <button aria-pressed={country === 'UK'} onClick={() => setManualCountry('UK')} type="button">United Kingdom</button>
          </div>
          <div className="tax-helper__country" role="group" aria-label="Choose tax-year period">
            <button aria-pressed={period === 'completed'} onClick={() => setPeriod('completed')} type="button">Last completed</button>
            <button aria-pressed={period === 'current'} onClick={() => setPeriod('current')} type="button">Current year</button>
          </div>
        </div>

        <section className="tax-helper__readiness" aria-labelledby="tax-readiness-heading">
          <div className="tax-helper__readiness-icon" aria-hidden="true"><FileCheck2 /></div>
          <div className="tax-helper__readiness-copy">
            <p>{country === 'Ireland' ? 'Calendar year' : 'UK tax year'} {window.label}</p>
            <h2 id="tax-readiness-heading">
              {!isDemo && isLoading ? 'Checking your confirmed history…' : !isDemo && isError ? 'Your payslip history is unavailable' : `${confirmedThisYear.length} confirmed ${confirmedThisYear.length === 1 ? 'payslip' : 'payslips'} ready`}
            </h2>
            <span>
              {!isDemo && isError
                ? 'Nothing has been changed. Try again later before relying on this count.'
                : confirmedThisYear.length
                  ? 'Use these as your personal evidence when reviewing the figures held by the official service.'
                  : 'Confirm your payslips as you go so the year-end review does not begin from a pile of documents.'}
            </span>
          </div>
          <Button asChild className="tax-helper__history-action" variant="outline">
            <Link to={historyPath}>Open payslip history <ArrowRight aria-hidden="true" /></Link>
          </Button>
        </section>

        <TaxChecklist
          country={country}
          historyPath={historyPath}
          key={`${isDemo ? 'sample' : user?.id ?? 'account'}:${country}:${window.label}`}
          steps={steps}
          taxYearLabel={window.label}
          userId={isDemo ? null : user?.id ?? null}
        />

        <aside className="tax-helper__boundary">
          <ShieldCheck aria-hidden="true" />
          <div>
            <h2>Guidance, not a refund calculation</h2>
            <p>Payslip Insights does not calculate your final liability, decide which reliefs apply, access your government account, submit a return, or promise a refund. Confirm every figure in the official service or with a qualified professional.</p>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
};

export default TaxHelper;
