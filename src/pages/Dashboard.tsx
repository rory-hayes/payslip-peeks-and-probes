import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/AppLayout';
import { usePayslips, useAnomalies, usePayTrends } from '@/hooks/use-payslip-data';
import { useUsage } from '@/hooks/use-usage';
import ExpectedVsActual from '@/components/ExpectedVsActual';
import YearToDateSummary from '@/components/YearToDateSummary';
import UpgradePrompt from '@/components/UpgradePrompt';
import { useCurrency, useProfile } from '@/hooks/use-profile';
import { formatDate } from '@/lib/date-utils';
import { deriveUsualPayBaseline } from '@/lib/pay-baseline';
import { getTaxEstimateAvailability } from '@/lib/tax-estimate-availability';
import type { DeductionOptions } from '@/lib/tax-calculator';
import { useDemo } from '@/contexts/DemoContext';
import DemoPayslipPreview, { type DemoPayslipPreviewState } from '@/components/DemoPayslipPreview';
import DemoReadOnlyLink from '@/components/DemoReadOnlyLink';
import { DEMO_PAYSLIPS, DEMO_ANOMALIES, DEMO_TRENDS } from '@/lib/demo-data';
import type { Payslip, AnomalyResult, PayTrend } from '@/lib/types';
import payslipCheckHero from '@/assets/option-one-payslip-check-hero-v1.webp';
import aquaCorner from '@/assets/option-one-aqua-corner-v2.webp';
import {
  Upload, TrendingUp, TrendingDown, AlertTriangle, FileText, ArrowRight, Download,
  Shield, Sparkles, X, GitCompareArrows, MessageSquareText, Landmark,
} from 'lucide-react';
import './Dashboard.css';

const ExpectedVsActualChart = lazy(() => import('@/components/ExpectedVsActualChart'));
const NetPayTrendChart = lazy(() => import('@/components/NetPayTrendChart'));
const YearToDateChart = lazy(() => import('@/components/YearToDateChart'));

const Dashboard = () => {
  const { isDemo, disableDemo } = useDemo();
  const navigate = useNavigate();
  const { data: payslips, isLoading: loadingSlips, error: payslipsError, refetch: refetchPayslips } = usePayslips();
  const { data: anomalies, isLoading: loadingAnomalies, error: anomaliesError, refetch: refetchAnomalies } = useAnomalies();
  const { data: trends } = usePayTrends();
  const { data: profile } = useProfile();
  const { format: formatCurrency, symbol: currSym, currency } = useCurrency();
  const {
    accessError,
    accessPending,
    accessReady,
    automaticChecksUsed,
    draftsRemaining,
    isPremium,
    limits,
    refetchAccess,
    uploadLimit,
    uploadsRemaining,
  } = useUsage();
  const [demoPreview, setDemoPreview] = useState<DemoPayslipPreviewState | null>(null);

  const isLoading = isDemo ? false : loadingSlips || loadingAnomalies;
  const hasDataLoadError = !isDemo && Boolean(payslipsError || anomaliesError);
  const allPayslips: Payslip[] = isDemo ? DEMO_PAYSLIPS : (payslips || []);
  const confirmedPayslips = allPayslips.filter((payslip) => payslip.status === 'confirmed');
  const pendingReview = isDemo ? null : allPayslips.find((payslip) => payslip.status === 'extracted') ?? null;
  const isEmpty = !isLoading && !isDemo && !hasDataLoadError && allPayslips.length === 0;
  const isAwaitingReview = !isLoading && !isDemo && confirmedPayslips.length === 0 && Boolean(pendingReview);
  const isCheckingPayslip = !isLoading && !isDemo && confirmedPayslips.length === 0 && allPayslips.length > 0 && !pendingReview;
  const allAnomalies: AnomalyResult[] = isDemo ? DEMO_ANOMALIES : (anomalies || []);
  const allTrends: PayTrend[] | undefined = isDemo ? DEMO_TRENDS : trends;

  const latest = confirmedPayslips.length > 0 ? confirmedPayslips[confirmedPayslips.length - 1] : null;
  const previous = confirmedPayslips.length > 1 ? confirmedPayslips[confirmedPayslips.length - 2] : null;
  const netChange = latest && previous ? latest.net_pay - previous.net_pay : 0;
  const usualPayBaseline = deriveUsualPayBaseline(confirmedPayslips);
  const hasUsualPayBaseline = usualPayBaseline.status === 'ready'
    && usualPayBaseline.usualNetPay !== null
    && usualPayBaseline.netDifference !== null;
  const newAnomalies = allAnomalies.filter((anomaly) => anomaly.status === 'new');
  const unresolvedCount = newAnomalies.length;
  const featuredAnomaly = newAnomalies[0];

  const demoCurrencyFormat = (value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  const fmtCurrency = isDemo ? demoCurrencyFormat : formatCurrency;
  const sym = isDemo ? '£' : currSym;
  const usualPayCompareUrl = hasUsualPayBaseline && latest && usualPayBaseline.referencePayslipId
    ? `/compare?current=${encodeURIComponent(latest.id)}&previous=${encodeURIComponent(usualPayBaseline.referencePayslipId)}`
    : null;
  const hasExpectedVsActualChart = Boolean(
    profile?.annual_salary
    && confirmedPayslips.length >= 2
    && confirmedPayslips.every((payslip) => getTaxEstimateAvailability(profile.country, payslip.pay_date).available),
  );
  const currentYear = new Date().getFullYear();
  const hasYearToDateChart = confirmedPayslips.filter(
    (payslip) => new Date(payslip.pay_date).getFullYear() === currentYear,
  ).length >= 2;
  const showFreeUsage = !isDemo && accessReady && !isPremium;
  const showUsageAccessError = !isDemo && accessError;
  const showUsageAccessPending = !isDemo && accessPending && !accessError;

  const leaveDemoForSignUp = () => {
    setDemoPreview(null);
    navigate('/sign-up', { state: { exitDemo: true } });
  };

  const closeDemoPreview = (open: boolean) => {
    if (!open) setDemoPreview(null);
  };

  const handleExportPdf = async () => {
    if (confirmedPayslips.length === 0) return;
    const { generatePaySummaryPdf } = await import('@/lib/generate-pay-summary-pdf');
    const studentLoanPlan = profile?.student_loan_plan;
    const deductionOpts: DeductionOptions = {
      pensionPercent: profile?.has_pension ? (profile.pension_percent ?? 5) : 0,
      hasStudentLoan: profile?.has_student_loan,
      studentLoanPlan: studentLoanPlan === 'plan1' || studentLoanPlan === 'plan2' || studentLoanPlan === 'plan4' || studentLoanPlan === 'plan5' || studentLoanPlan === 'postgrad' ? studentLoanPlan : 'plan2',
      subRegion: profile?.sub_region,
      filingStatus: profile?.filing_status,
    };
    generatePaySummaryPdf({
      payslips: confirmedPayslips,
      currency,
      country: profile?.country ?? null,
      annualSalary: profile?.annual_salary,
      deductionOpts,
      firstName: profile?.first_name,
    });
  };

  return (
    <AppLayout>
      <div className="pi-dashboard">
        <img className="pi-dashboard__aqua-corner" src={aquaCorner} alt="" aria-hidden="true" />
        {isDemo && (
          <section className="pi-dashboard__demo" aria-label="Demo information">
            <div className="pi-dashboard__demo-copy">
              <Sparkles className="pi-dashboard__demo-icon" aria-hidden="true" />
              <p>
                <strong>You&apos;re viewing sample data.</strong>{' '}
                <span>This read-only demo keeps sample payslips on this dashboard.</span>
              </p>
            </div>
            <div className="pi-dashboard__demo-actions">
              <Button className="pi-dashboard__small-primary" size="sm" onClick={leaveDemoForSignUp}>
                Sign up free
              </Button>
              <Button
                className="pi-dashboard__icon-button"
                variant="ghost"
                size="icon"
                aria-label="Exit demo"
                onClick={() => { disableDemo(); navigate('/'); }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </section>
        )}

        <header className="pi-dashboard__topline">
          <div>
            <h1>Your payday, clear.</h1>
            <p>
              {isDemo
                ? 'Explore a sample payslip check and the next steps it can unlock.'
                : isEmpty
                  ? 'Start with a payslip. We will help you understand the important bits before you rely on them.'
                  : isAwaitingReview
                    ? 'Your latest payslip is ready for a quick confirmation before it appears in your dashboard.'
                    : isCheckingPayslip
                      ? 'Your payslip is still being checked. It will appear here once there are figures ready for review.'
                    : 'Your latest pay, what is worth checking, and a calmer next step.'}
            </p>
          </div>
          <div className="pi-dashboard__topline-actions">
            {confirmedPayslips.length > 0 && (
              <Button className="pi-dashboard__quiet-action" variant="outline" onClick={handleExportPdf}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Export PDF
              </Button>
            )}
            {isDemo ? (
              <Button className="pi-dashboard__primary-action" onClick={leaveDemoForSignUp}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Sign up to upload
              </Button>
            ) : pendingReview ? (
              <Button asChild className="pi-dashboard__primary-action">
                <Link to={`/vault?review=${encodeURIComponent(pendingReview.id)}`}>
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Review payslip
                </Link>
              </Button>
            ) : isCheckingPayslip ? (
              <Button asChild className="pi-dashboard__primary-action">
                <Link to="/vault">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  View upload status
                </Link>
              </Button>
            ) : (
              <Button asChild className="pi-dashboard__primary-action">
                <Link to="/vault">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload payslip
                </Link>
              </Button>
            )}
          </div>
        </header>

        {isLoading && (
          <section className="pi-dashboard__loading" aria-label="Loading your payslip dashboard">
            <div className="pi-dashboard__loading-card pi-dashboard__loading-card--pay"><Skeleton className="h-4 w-20" /><Skeleton className="h-12 w-44" /><Skeleton className="h-4 w-32" /></div>
            <div className="pi-dashboard__loading-card"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-9 w-28" /></div>
            <div className="pi-dashboard__loading-card"><Skeleton className="h-5 w-28" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
          </section>
        )}

        {hasDataLoadError && (
          <section className="pi-dashboard__empty" aria-labelledby="dashboard-load-error-heading" role="alert">
            <div className="pi-dashboard__empty-copy">
              <div className="pi-dashboard__empty-icon" aria-hidden="true"><AlertTriangle className="h-7 w-7" /></div>
              <h2 id="dashboard-load-error-heading">We couldn’t load your latest pay data.</h2>
              <p>
                Your saved payslips have not been changed. Check your connection and try again before relying on this dashboard.
              </p>
              <Button
                className="pi-dashboard__primary-action pi-dashboard__primary-action--roomy"
                onClick={() => {
                  void refetchPayslips();
                  void refetchAnomalies();
                }}
              >
                Try again
              </Button>
            </div>
            <img className="pi-dashboard__empty-art" src={payslipCheckHero} alt="" aria-hidden="true" />
          </section>
        )}

        {isEmpty && (
          <section className="pi-dashboard__empty" aria-labelledby="empty-dashboard-heading">
            <div className="pi-dashboard__empty-copy">
              <div className="pi-dashboard__empty-icon" aria-hidden="true"><Sparkles className="h-7 w-7" /></div>
              <h2 id="empty-dashboard-heading">Just got paid?</h2>
              <p>
                Add a payslip and Payslip Insights will extract the key figures, compare them against your profile, and flag changes worth checking. We use the document to provide these features; read the <Link to="/privacy">Privacy Policy</Link> for current handling details.
              </p>
              <Button asChild className="pi-dashboard__primary-action pi-dashboard__primary-action--roomy">
                <Link to="/vault">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload your first payslip
                </Link>
              </Button>
              <span className="pi-dashboard__file-note">Add a PDF, photo or screenshot</span>
            </div>
            <img className="pi-dashboard__empty-art" src={payslipCheckHero} alt="" aria-hidden="true" />
            <div className="pi-dashboard__empty-promises">
              <div><Shield className="h-5 w-5" aria-hidden="true" /><span>Review before confirming</span></div>
              <div><AlertTriangle className="h-5 w-5" aria-hidden="true" /><span>Changes worth checking</span></div>
              <div><TrendingUp className="h-5 w-5" aria-hidden="true" /><span>Track pay trends</span></div>
            </div>
          </section>
        )}

        {isAwaitingReview && pendingReview ? (
          <section className="pi-dashboard__empty" aria-labelledby="review-pending-heading">
            <div className="pi-dashboard__empty-copy">
              <div className="pi-dashboard__empty-icon" aria-hidden="true"><FileText className="h-7 w-7" /></div>
              <h2 id="review-pending-heading">Confirm your payslip before it joins your history.</h2>
              <p>
                The extracted figures are waiting for your review. Check them against your original payslip before they appear in your pay history or comparisons.
              </p>
              <Button asChild className="pi-dashboard__primary-action pi-dashboard__primary-action--roomy">
                <Link to={`/vault?review=${encodeURIComponent(pendingReview.id)}`}>
                  Check the details
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <img className="pi-dashboard__empty-art" src={payslipCheckHero} alt="" aria-hidden="true" />
            <div className="pi-dashboard__empty-promises">
              <div><Shield className="h-5 w-5" aria-hidden="true" /><span>Review before confirming</span></div>
              <div><AlertTriangle className="h-5 w-5" aria-hidden="true" /><span>Changes worth checking</span></div>
              <div><TrendingUp className="h-5 w-5" aria-hidden="true" /><span>Track confirmed pay only</span></div>
            </div>
          </section>
        ) : null}

        {isCheckingPayslip ? (
          <section className="pi-dashboard__empty" aria-labelledby="processing-payslip-heading">
            <div className="pi-dashboard__empty-copy">
              <div className="pi-dashboard__empty-icon" aria-hidden="true"><FileText className="h-7 w-7" /></div>
              <h2 id="processing-payslip-heading">We’re checking your payslip.</h2>
              <p>
                We’ll only show figures here after they are ready for your review. You can return to your vault to check its current status.
              </p>
              <Button asChild className="pi-dashboard__primary-action pi-dashboard__primary-action--roomy">
                <Link to="/vault">
                  Open payslip vault
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <img className="pi-dashboard__empty-art" src={payslipCheckHero} alt="" aria-hidden="true" />
            <div className="pi-dashboard__empty-promises">
              <div><Shield className="h-5 w-5" aria-hidden="true" /><span>Figures stay unconfirmed</span></div>
              <div><AlertTriangle className="h-5 w-5" aria-hidden="true" /><span>Review comes next</span></div>
              <div><TrendingUp className="h-5 w-5" aria-hidden="true" /><span>Compare after confirmation</span></div>
            </div>
          </section>
        ) : null}

        {!isLoading && latest && (
          <>
            <section className="pi-dashboard__payday-grid" aria-label="Your latest payday">
              <div className="pi-dashboard__pay-card">
                <p className="pi-dashboard__kicker">Net pay</p>
                <p className="pi-dashboard__pay-amount">{fmtCurrency(latest.net_pay)}</p>
                <p className="pi-dashboard__pay-date"><FileText className="h-4 w-4" aria-hidden="true" /> Paid {formatDate(latest.pay_date)}</p>
                <div className="pi-dashboard__pay-card-footer">
                  {previous ? (
                    <p className={netChange >= 0 ? 'pi-dashboard__change pi-dashboard__change--up' : 'pi-dashboard__change pi-dashboard__change--down'}>
                      {netChange >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
                      <span><strong>{fmtCurrency(Math.abs(netChange))}</strong> {netChange >= 0 ? 'more' : 'less'} than last time</span>
                    </p>
                  ) : <p className="pi-dashboard__first-pay">Your first payslip in the timeline.</p>}
                  <DemoReadOnlyLink
                    className="pi-dashboard__payslip-link"
                    demoAriaLabel="Open sample payslip preview"
                    isDemo={isDemo}
                    onDemoActivate={() => setDemoPreview({ anomaly: featuredAnomaly, payslip: latest })}
                    to={`/payslip/${latest.id}`}
                  >
                    {isDemo ? <>Review sample payslip <ArrowRight className="h-4 w-4" aria-hidden="true" /></> : <>Open payslip <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
                  </DemoReadOnlyLink>
                </div>
              </div>

              <div className="pi-dashboard__snapshot-card">
                <div className="pi-dashboard__snapshot-item">
                  <span>Gross pay</span>
                  <strong>{fmtCurrency(latest.gross_pay)}</strong>
                </div>
                <div className="pi-dashboard__snapshot-divider" aria-hidden="true" />
                <div className="pi-dashboard__snapshot-item">
                  <span>Changes to check</span>
                  <strong>{unresolvedCount}</strong>
                  {unresolvedCount > 0 && !isDemo ? <Link to="/anomalies">Review now <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link> : null}
                  {unresolvedCount > 0 && isDemo ? <small>Sample issues are below</small> : null}
                  {unresolvedCount === 0 ? <small>No new changes flagged</small> : null}
                </div>
                <div className="pi-dashboard__snapshot-divider" aria-hidden="true" />
                <div className="pi-dashboard__snapshot-item">
                  <span>Pay history</span>
                  <strong>{confirmedPayslips.length}</strong>
                  <small>{confirmedPayslips.length === 1 ? 'payslip saved' : 'payslips saved'}</small>
                </div>
              </div>
            </section>

            <section className="pi-dashboard__check-banner" aria-labelledby="check-banner-heading">
              <div className="pi-dashboard__check-copy">
                <div className="pi-dashboard__check-mark" aria-hidden="true">
                  {hasUsualPayBaseline ? <GitCompareArrows className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <h2 id="check-banner-heading">
                    {hasUsualPayBaseline
                      ? usualPayBaseline.netDifference === 0
                        ? 'Your take-home is in line with your usual pay'
                        : 'What changed from your usual pay?'
                      : featuredAnomaly
                        ? (unresolvedCount === 1 ? 'One thing worth checking' : `${unresolvedCount} things worth checking`)
                        : 'Your latest check is ready'}
                  </h2>
                  <p>
                    {hasUsualPayBaseline
                      ? usualPayBaseline.netDifference === 0
                        ? `Your take-home is in line with your usual ${fmtCurrency(usualPayBaseline.usualNetPay)}. Based on your last ${usualPayBaseline.sampleSize} confirmed payslips.`
                        : `Your take-home was ${fmtCurrency(Math.abs(usualPayBaseline.netDifference))} ${usualPayBaseline.netDifference > 0 ? 'higher' : 'lower'} than your usual ${fmtCurrency(usualPayBaseline.usualNetPay)}. Based on your last ${usualPayBaseline.sampleSize} confirmed payslips.`
                      : featuredAnomaly
                        ? featuredAnomaly.title
                        : 'No new changes are currently flagged. You can still review the figures before relying on them.'}
                  </p>
                  <div className="pi-dashboard__check-actions">
                    {usualPayCompareUrl && !isDemo ? <Link to={usualPayCompareUrl} className="pi-dashboard__inline-link">Compare the figures <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : null}
                    {featuredAnomaly && !isDemo ? <Link to="/anomalies" className="pi-dashboard__inline-link pi-dashboard__inline-link--secondary">{unresolvedCount === 1 ? 'Review the detail' : `${unresolvedCount} things worth checking`} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link> : null}
                    {isDemo && (hasUsualPayBaseline || featuredAnomaly) ? <span className="pi-dashboard__demo-note">Sample data only</span> : null}
                  </div>
                </div>
              </div>
              <img className="pi-dashboard__check-art" src={payslipCheckHero} alt="" aria-hidden="true" />
            </section>

            <section className="pi-dashboard__next-grid" aria-label="Your next actions">
              <article className="pi-dashboard__next-card pi-dashboard__next-card--primary">
                <div className="pi-dashboard__next-icon" aria-hidden="true"><MessageSquareText /></div>
                <div>
                  <p className="pi-dashboard__next-kicker">Turn insight into action</p>
                  <h2>Ask payroll a clear question.</h2>
                  <p>Build a concise message from the figures you confirmed and the change you want explained.</p>
                </div>
                {isDemo ? (
                  <button className="pi-dashboard__next-link" onClick={() => setDemoPreview({ anomaly: featuredAnomaly, payslip: latest })} type="button">
                    See the evidence first <ArrowRight aria-hidden="true" />
                  </button>
                ) : (
                  <Link className="pi-dashboard__next-link" to={`/draft/${latest.id}`}>
                    Prepare my question <ArrowRight aria-hidden="true" />
                  </Link>
                )}
              </article>

              <article className="pi-dashboard__next-card pi-dashboard__next-card--tax">
                <div className="pi-dashboard__next-icon" aria-hidden="true"><Landmark /></div>
                <div>
                  <p className="pi-dashboard__next-kicker">Official-source guide</p>
                  <h2>Keep your tax year on track.</h2>
                  <p>Scan common topics, bring confirmed payslips together, and follow the right Revenue or HMRC steps—without refund promises.</p>
                </div>
                <Link className="pi-dashboard__next-link" to="/tax-helper">
                  Open tax-year helper <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            </section>

            {showUsageAccessPending && (
              <section className="pi-dashboard__usage" aria-label="Checking account access" role="status">
                <div className="pi-dashboard__usage-heading">
                  <div>
                    <h2>Checking your account access</h2>
                    <p>We’re confirming your plan and included usage before showing upgrade options.</p>
                  </div>
                </div>
              </section>
            )}

            {showUsageAccessError && (
              <section className="pi-dashboard__usage" aria-label="Account access check failed" role="alert">
                <div className="pi-dashboard__usage-heading">
                  <div>
                    <h2>We couldn’t verify your account access</h2>
                    <p>Check your connection and try again before relying on usage or upgrade options.</p>
                  </div>
                  <Button className="pi-dashboard__quiet-action" variant="outline" onClick={() => { void refetchAccess(); }}>
                    Try again
                  </Button>
                </div>
              </section>
            )}

            {showFreeUsage && (
              <section className="pi-dashboard__usage" aria-label="Free plan usage">
                <div className="pi-dashboard__usage-heading">
                  <div>
                    <h2>Free plan usage</h2>
                    <p>Your two automatic checks are a one-time Free allowance. Payroll-message drafts renew monthly.</p>
                  </div>
                  <Button asChild className="pi-dashboard__quiet-action" variant="outline">
                    <Link to="/pricing">Upgrade</Link>
                  </Button>
                </div>
                <div className="pi-dashboard__usage-bars">
                  <UsageBar
                    label="Automatic checks · Free total"
                    used={automaticChecksUsed}
                    limit={uploadLimit}
                    depleted={uploadsRemaining === 0}
                  />
                  <UsageBar
                    label="Drafts · this month"
                    used={limits.drafts_per_month - draftsRemaining}
                    limit={limits.drafts_per_month}
                    depleted={draftsRemaining === 0}
                  />
                </div>
              </section>
            )}

            {showFreeUsage && (uploadsRemaining === 0 || draftsRemaining === 0) && (
              <UpgradePrompt
                title="You've hit your free limit"
                description="See Plus options for up to 6 automatic checks and 12 payroll-message drafts per calendar month."
              />
            )}

            <section className="pi-dashboard__details" aria-labelledby="pay-details-heading">
              <div className="pi-dashboard__section-heading">
                <div>
                  <h2 id="pay-details-heading">Your pay detail</h2>
                  <p>Look back at the figures behind your latest payslip.</p>
                </div>
              </div>
              <div className="pi-dashboard__detail-stack">
                <ExpectedVsActual latestPayslip={latest} />
                {hasExpectedVsActualChart ? (
                  <Suspense fallback={<div className="pi-dashboard__chart-loading"><Skeleton className="h-full w-full" /></div>}>
                    <ExpectedVsActualChart payslips={confirmedPayslips} />
                  </Suspense>
                ) : null}
                <YearToDateSummary payslips={confirmedPayslips} />
                {hasYearToDateChart ? (
                  <Suspense fallback={<div className="pi-dashboard__chart-loading"><Skeleton className="h-full w-full" /></div>}>
                    <YearToDateChart payslips={confirmedPayslips} />
                  </Suspense>
                ) : null}
              </div>
            </section>

            <section className="pi-dashboard__lower-grid" aria-label="Pay history and changes">
              {allTrends && allTrends.length > 1 && (
                <article className="pi-dashboard__panel pi-dashboard__panel--trend">
                  <div className="pi-dashboard__panel-heading">
                    <div>
                      <h2>Net pay trend</h2>
                      <p>Your saved payslips over time.</p>
                    </div>
                  </div>
                  <div className="pi-dashboard__chart">
                    <Suspense fallback={<Skeleton className="h-full w-full" />}>
                      <NetPayTrendChart currencySymbol={sym} formatCurrency={fmtCurrency} trends={allTrends} />
                    </Suspense>
                  </div>
                </article>
              )}

              {newAnomalies.length > 0 && (
                <article className={`pi-dashboard__panel pi-dashboard__panel--anomalies ${allTrends && allTrends.length > 1 ? '' : 'pi-dashboard__panel--wide'}`}>
                  <div className="pi-dashboard__panel-heading">
                    <div>
                      <h2>Worth another look</h2>
                      <p>{isDemo ? 'Sample data only.' : 'Changes from your saved payslips.'}</p>
                    </div>
                    {!isDemo && <Link to="/anomalies" className="pi-dashboard__inline-link">View all <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
                  </div>
                  <div className="pi-dashboard__anomaly-list">
                    {newAnomalies.slice(0, 4).map((anomaly) => (
                      <DemoReadOnlyLink
                        key={anomaly.id}
                        className="pi-dashboard__anomaly-row"
                        demoAriaLabel={`Open sample details: ${anomaly.title}`}
                        isDemo={isDemo}
                        onDemoActivate={() => setDemoPreview({
                          anomaly,
                          payslip: allPayslips.find((payslip) => payslip.id === anomaly.payslip_id) ?? latest,
                        })}
                        to={`/payslip/${anomaly.payslip_id}`}
                      >
                        <div className={`pi-dashboard__anomaly-icon pi-dashboard__anomaly-icon--${anomaly.severity}`}><AlertTriangle className="h-4 w-4" aria-hidden="true" /></div>
                        <div className="pi-dashboard__anomaly-copy">
                          <p>{anomaly.title}</p>
                          <span>{formatDate(anomaly.payslip_date)}</span>
                        </div>
                        <Badge variant="outline" className="pi-dashboard__severity">{anomaly.severity}</Badge>
                      </DemoReadOnlyLink>
                    ))}
                  </div>
                </article>
              )}
            </section>

            <section className="pi-dashboard__history" aria-labelledby="pay-history-heading">
              <div className="pi-dashboard__section-heading">
                <div>
                  <h2 id="pay-history-heading">Your pay history</h2>
                  <p>Confirmed and saved payslips in one clear place.</p>
                </div>
                {!isDemo && <Link to="/vault" className="pi-dashboard__inline-link">View all <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>}
              </div>
              <div className="pi-dashboard__history-list">
                {confirmedPayslips.slice().reverse().slice(0, 4).map((slip) => {
                  const sampleAnomaly = allAnomalies.find((anomaly) => anomaly.payslip_id === slip.id);

                  return (
                    <DemoReadOnlyLink
                      key={slip.id}
                      className="pi-dashboard__history-row"
                      demoAriaLabel={`Open sample payslip from ${formatDate(slip.pay_date)}`}
                      isDemo={isDemo}
                      onDemoActivate={() => setDemoPreview({ anomaly: sampleAnomaly, payslip: slip })}
                      to={`/payslip/${slip.id}`}
                    >
                      <div className="pi-dashboard__history-icon"><FileText className="h-5 w-5" aria-hidden="true" /></div>
                      <div className="pi-dashboard__history-copy">
                        <p>{formatDate(slip.pay_date)}</p>
                        <span>{slip.employer_name}</span>
                      </div>
                      <div className="pi-dashboard__history-amount">
                        <strong>{fmtCurrency(slip.net_pay)}</strong>
                        <span>net pay</span>
                      </div>
                      {slip.anomaly_count > 0 && <Badge variant="destructive" className="pi-dashboard__history-badge">{slip.anomaly_count}</Badge>}
                    </DemoReadOnlyLink>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {isDemo ? (
          <DemoPayslipPreview
            onOpenChange={closeDemoPreview}
            onSignUp={leaveDemoForSignUp}
            preview={demoPreview}
          />
        ) : null}

        <p className="pi-dashboard__disclaimer">
          Payslip Insights provides guidance and issue spotting — not formal tax, legal, or payroll advice. Always confirm findings with your employer or a professional.
        </p>
      </div>
    </AppLayout>
  );
};

function UsageBar({ label, used, limit, depleted }: { label: string; used: number; limit: number; depleted: boolean }) {
  const percent = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;

  return (
    <div className="pi-dashboard__usage-item">
      <div className="pi-dashboard__usage-label"><span>{label}</span><strong>{used}/{limit}</strong></div>
      <div className="pi-dashboard__usage-track" aria-label={`${label}: ${used} of ${limit} used`} role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.max(0, used)}>
        <div className={depleted ? 'pi-dashboard__usage-fill pi-dashboard__usage-fill--depleted' : 'pi-dashboard__usage-fill'} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default Dashboard;
