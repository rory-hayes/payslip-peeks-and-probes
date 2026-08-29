import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, CheckCircle2, ClipboardCopy, Clock3, ExternalLink, FileCheck2, Files, Landmark, Plus, ReceiptText, ShieldCheck, Sparkles, X } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { usePayslips } from '@/hooks/use-payslip-data';
import { useProfile } from '@/hooks/use-profile';
import { useAuth } from '@/contexts/AuthContext';
import { useDemo } from '@/contexts/DemoContext';
import { DEMO_TAX_PAYSLIPS } from '@/lib/demo-data';
import {
  buildTaxReviewDocumentList,
  buildTaxReviewPlanText,
  CURRENT_TAX_STEPS,
  isDateInTaxYear,
  OFFICIAL_TAX_STEPS,
  TAX_REVIEW_TOPICS,
  taxReviewTiming,
  taxYearWindow,
  type OfficialTaxStep,
  type TaxHelperCountry,
  type TaxReviewPeriod,
  type TaxReviewTopic,
} from '@/lib/tax-helper';
import {
  browserTaxReviewProgressStorage,
  readTaxReviewProgress,
  writeTaxReviewProgress,
  writeTaxReviewTopicSelection,
} from '@/lib/tax-review-progress';
import './TaxHelper.css';

function countryFromProfile(country: string | null | undefined): TaxHelperCountry {
  return country === 'UK' ? 'UK' : 'Ireland';
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function TaxTopicPlanner({
  country,
  hasPensionEvidence,
  isSample,
  period,
  steps,
  taxYearLabel,
  topics,
  userId,
}: {
  country: TaxHelperCountry;
  hasPensionEvidence: boolean;
  isSample: boolean;
  period: TaxReviewPeriod;
  steps: OfficialTaxStep[];
  taxYearLabel: string;
  topics: TaxReviewTopic[];
  userId: string | null;
}) {
  const validTopicIds = useMemo(() => topics.map((topic) => topic.id), [topics]);
  const initialProgress = useMemo(() => (
    userId
      ? readTaxReviewProgress(
        browserTaxReviewProgressStorage(),
        userId,
        country,
        taxYearLabel,
        [],
        validTopicIds,
      )
      : { available: false, reviewedStepIds: [], selectedTopicIds: [] }
  ), [country, taxYearLabel, userId, validTopicIds]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialProgress.selectedTopicIds),
  );
  const [canPersist, setCanPersist] = useState(initialProgress.available);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const selectedTopics = topics.filter((topic) => selected.has(topic.id));
  const documents = buildTaxReviewDocumentList(country, selectedTopics);
  const baseDocumentCount = buildTaxReviewDocumentList(country, []).length;

  const persistSelection = (next: Set<string>) => {
    if (!userId) return;
    setCanPersist(writeTaxReviewTopicSelection(
      browserTaxReviewProgressStorage(),
      userId,
      country,
      taxYearLabel,
      [...next],
      validTopicIds,
    ));
  };

  const toggleTopic = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setCopyStatus('idle');
    persistSelection(next);
  };

  const clearTopics = () => {
    const next = new Set<string>();
    setSelected(next);
    setCopyStatus('idle');
    persistSelection(next);
  };

  const handleCopy = async () => {
    const copied = await copyText(buildTaxReviewPlanText({
      country,
      documents,
      period,
      steps,
      taxYearLabel,
      topics: selectedTopics,
    }));
    setCopyStatus(copied ? 'copied' : 'failed');
  };

  const persistenceMessage = userId
    ? canPersist
      ? 'Your choices are saved on this browser.'
      : 'Your choices are not being saved on this browser.'
    : 'Sample choices reset when you leave.';

  return (
    <>
      <section className="tax-helper__scan" aria-labelledby="tax-scan-heading">
        <div className="tax-helper__section-heading tax-helper__section-heading--scan">
          <div>
            <p className="tax-helper__eyebrow">Five-minute scan</p>
            <h2 id="tax-scan-heading">Could any of these apply to you?</h2>
            <p className="tax-helper__section-intro">
              Add anything familiar to your review plan. This does not decide eligibility or estimate a refund—the official rules do.
            </p>
          </div>
          <div className="tax-helper__scan-note"><ReceiptText aria-hidden="true" /> {topics.length} common areas</div>
        </div>

        <div className="tax-helper__topic-grid">
          {topics.map((topic) => {
            const hasSignal = hasPensionEvidence && topic.payslipSignal === 'pension';
            const isSelected = selected.has(topic.id);
            const className = [
              'tax-helper__topic',
              hasSignal ? 'is-signalled' : '',
              isSelected ? 'is-selected' : '',
            ].filter(Boolean).join(' ');

            return (
              <article className={className} key={topic.id}>
                <div className="tax-helper__topic-meta">
                  <span><Landmark aria-hidden="true" /> {topic.source}</span>
                  {hasSignal ? <strong><Sparkles aria-hidden="true" /> {isSample ? 'Seen in the sample' : 'Seen in your payslips'}</strong> : null}
                </div>
                <h3>{topic.title}</h3>
                <p className="tax-helper__topic-prompt">{topic.prompt}</p>
                <p className="tax-helper__topic-description">{topic.description}</p>
                <div className="tax-helper__topic-actions">
                  <button
                    aria-pressed={isSelected}
                    className="tax-helper__topic-select"
                    onClick={() => toggleTopic(topic.id)}
                    type="button"
                  >
                    {isSelected ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                    {isSelected ? 'In my review' : 'Add to my review'}
                  </button>
                  <a href={topic.href} rel="noreferrer" target="_blank">
                    {topic.action} <ExternalLink aria-hidden="true" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="tax-helper__plan" aria-labelledby="tax-plan-heading">
        <div className="tax-helper__plan-heading">
          <div>
            <p className="tax-helper__eyebrow">Your review plan</p>
            <h2 id="tax-plan-heading">Know what to have ready.</h2>
            <p>Keep these records privately. Payslip Insights does not ask you to upload supporting tax documents here.</p>
          </div>
          <span><Files aria-hidden="true" /> {selectedTopics.length} {selectedTopics.length === 1 ? 'area' : 'areas'} selected</span>
        </div>

        <div className="tax-helper__plan-grid">
          <article className="tax-helper__plan-card">
            <h3>Always useful</h3>
            <p>Start with the records that connect your pay to the official account.</p>
            <ul>
              {documents.slice(0, baseDocumentCount).map((document) => (
                <li key={document}><CheckCircle2 aria-hidden="true" /> {document}</li>
              ))}
            </ul>
          </article>

          <article className="tax-helper__plan-card">
            <h3>For the areas you selected</h3>
            {selectedTopics.length ? (
              <div className="tax-helper__document-groups">
                {selectedTopics.map((topic) => (
                  <details key={topic.id} open={selectedTopics.length === 1}>
                    <summary>{topic.title}<span>{topic.documents.length} items</span></summary>
                    <ul>
                      {topic.documents.map((document) => (
                        <li key={document}><CheckCircle2 aria-hidden="true" /> {document}</li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            ) : (
              <div className="tax-helper__plan-empty">
                <Plus aria-hidden="true" />
                <p>Choose an area above and its helpful records will appear here.</p>
              </div>
            )}
          </article>
        </div>

        <div className="tax-helper__plan-actions">
          <Button onClick={handleCopy} type="button" variant="outline">
            <ClipboardCopy aria-hidden="true" /> Copy my action plan
          </Button>
          {selectedTopics.length ? (
            <button className="tax-helper__clear-plan" onClick={clearTopics} type="button">
              <X aria-hidden="true" /> Clear selected areas
            </button>
          ) : null}
          <small className={!userId ? 'is-neutral' : canPersist ? undefined : 'is-error'}>{persistenceMessage}</small>
          <span aria-live="polite" className={copyStatus === 'failed' ? 'is-error' : undefined}>
            {copyStatus === 'copied'
              ? 'Action plan copied.'
              : copyStatus === 'failed'
                ? 'Copy is unavailable in this browser.'
                : ''}
          </span>
        </div>
      </section>
    </>
  );
}

function TaxChecklist({
  country,
  historyPath,
  isSample,
  period,
  steps,
  taxYearLabel,
  userId,
}: {
  country: TaxHelperCountry;
  historyPath: string;
  isSample: boolean;
  period: TaxReviewPeriod;
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
          <h2 id="tax-steps-heading">{isSample ? 'Sample' : 'Your'} {taxYearLabel} {period === 'current' ? 'current-year plan' : 'review'}</h2>
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
            <h3>{isSample ? 'The sample' : `Your ${taxYearLabel}`} checklist is reviewed.</h3>
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
  const [period, setPeriod] = useState<TaxReviewPeriod>('completed');
  const country = manualCountry ?? (isDemo ? 'Ireland' : countryFromProfile(profile?.country));
  const window = useMemo(() => taxYearWindow(country, new Date(), period === 'completed' ? -1 : 0), [country, period]);
  const steps = period === 'current' ? CURRENT_TAX_STEPS[country] : OFFICIAL_TAX_STEPS[country];
  const timing = taxReviewTiming(country, window, period);
  const availablePayslips = isDemo ? DEMO_TAX_PAYSLIPS : (payslips ?? []);
  const confirmedThisYear = availablePayslips.filter(
    (payslip) => payslip.status === 'confirmed' && payslip.country === country && isDateInTaxYear(payslip.pay_date, window),
  );
  const hasPensionEvidence = confirmedThisYear.some((payslip) => (payslip.pension_amount ?? 0) > 0);
  const reviewTopics = [...TAX_REVIEW_TOPICS[country]].sort((first, second) => {
    if (!hasPensionEvidence) return 0;
    return Number(second.payslipSignal === 'pension') - Number(first.payslipSignal === 'pension');
  });
  const historyPath = isDemo ? '/dashboard#pay-history-heading' : '/vault';

  return (
    <AppLayout>
      <div className="tax-helper">
        <header className="tax-helper__hero">
          <div>
            <p className="tax-helper__eyebrow">{isDemo ? 'Sample tax-year review' : 'Tax year'}</p>
            <h1>{isDemo ? 'A tax year, organised.' : 'Your tax year, organised.'}</h1>
            <p className="tax-helper__intro">
              {isDemo
                ? `Explore how fictional payslips connect to the official ${country === 'Ireland' ? 'Revenue' : 'HMRC'} steps. The sample resets when you leave; the official service still makes every decision.`
                : `Bring your confirmed payslips together, then follow the official steps for ${country === 'Ireland' ? 'Revenue' : 'HMRC'}. We guide the review; the official service makes the decision.`}
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
              {!isDemo && isLoading
                ? 'Checking your confirmed history…'
                : !isDemo && isError
                  ? 'Your payslip history is unavailable'
                  : `${confirmedThisYear.length} ${isDemo ? 'sample' : 'confirmed'} ${confirmedThisYear.length === 1 ? 'payslip' : 'payslips'} ready`}
            </h2>
            <span>
              {!isDemo && isError
                ? 'Nothing has been changed. Try again later before relying on this count.'
                : isDemo
                  ? confirmedThisYear.length
                    ? 'These fictional figures show how a review can connect saved payslips with the official service.'
                    : 'The sample has no payslips for this country and tax year. The official checklist is still available below.'
                : confirmedThisYear.length
                  ? 'Use these as your personal evidence when reviewing the figures held by the official service.'
                  : 'Confirm your payslips as you go so the year-end review does not begin from a pile of documents.'}
            </span>
          </div>
          <Button asChild className="tax-helper__history-action" variant="outline">
            <Link to={historyPath}>{isDemo ? 'Open sample history' : 'Open payslip history'} <ArrowRight aria-hidden="true" /></Link>
          </Button>
        </section>

        <aside className="tax-helper__timing">
          <div className="tax-helper__timing-icon" aria-hidden="true"><Clock3 /></div>
          <div>
            <p className="tax-helper__eyebrow">{timing.eyebrow}</p>
            <h2>{timing.title}</h2>
            <p>{timing.description}</p>
          </div>
          <a href={timing.href} rel="noreferrer" target="_blank">{timing.action} <ExternalLink aria-hidden="true" /></a>
        </aside>

        <TaxTopicPlanner
          country={country}
          hasPensionEvidence={hasPensionEvidence}
          isSample={isDemo}
          key={`topics:${isDemo ? 'sample' : user?.id ?? 'account'}:${country}:${window.label}`}
          period={period}
          steps={steps}
          taxYearLabel={window.label}
          topics={reviewTopics}
          userId={isDemo ? null : user?.id ?? null}
        />

        <TaxChecklist
          country={country}
          historyPath={historyPath}
          isSample={isDemo}
          key={`${isDemo ? 'sample' : user?.id ?? 'account'}:${country}:${window.label}`}
          period={period}
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
