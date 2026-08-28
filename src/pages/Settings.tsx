import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUsage } from '@/hooks/use-usage';
import { useSubscription } from '@/hooks/use-subscription';
import { getStripeEnvironment } from '@/lib/stripe';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Trash2, HelpCircle, Sparkles, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { AccountDeletionBlockedError, AccountDeletionPendingError, deleteCurrentUserAccount } from '@/lib/delete-account';
import {
  LAUNCH_COUNTRY_LIST,
  getCountryConfig,
  isLaunchCountry,
  type CountryCode,
  type LaunchCountryCode,
} from '@/lib/countries';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { openCookiePreferences } from '@/lib/cookie-preferences';
import {
  browserTaxReviewProgressStorage,
  clearTaxReviewProgress,
  exportTaxReviewProgress,
} from '@/lib/tax-review-progress';

const STUDENT_LOAN_PLANS = [
  { value: 'plan1', label: 'Plan 1', desc: 'Started before Sep 2012 (England/Wales)' },
  { value: 'plan2', label: 'Plan 2', desc: 'Started Sep 2012 onwards (England/Wales)' },
  { value: 'plan4', label: 'Plan 4', desc: 'Scotland' },
  { value: 'plan5', label: 'Plan 5', desc: 'Started Aug 2023 onwards' },
  { value: 'postgrad', label: 'Postgraduate', desc: 'Postgraduate loan' },
];

type ExportPayslipJoin = { user_id?: string | null };
type ExportRow = Record<string, unknown> & {
  payslips?: ExportPayslipJoin | ExportPayslipJoin[] | null;
};

function rowsForExport(value: unknown): ExportRow[] {
  return Array.isArray(value) ? value as ExportRow[] : [];
}

function exportRowOwnerId(row: ExportRow): string | null {
  const payslip = Array.isArray(row.payslips) ? row.payslips[0] : row.payslips;
  return typeof payslip?.user_id === 'string' ? payslip.user_id : null;
}

function exportDataOrThrow<T>({ data, error }: { data: T; error: unknown | null }): T {
  if (error) throw error;
  return data;
}

const Settings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const { automaticChecksUsed, uploadsRemaining, draftsRemaining, isPremium, limits, uploadLimit, draftLimit } = useUsage();
  const [firstName, setFirstName] = useState('');
  const [country, setCountry] = useState<LaunchCountryCode | ''>('UK');
  const [annualSalary, setAnnualSalary] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [employer, setEmployer] = useState('');
  const [payrollEmail, setPayrollEmail] = useState('');
  const [hasPension, setHasPension] = useState(false);
  const [pensionPercent, setPensionPercent] = useState('5');
  const [hasStudentLoan, setHasStudentLoan] = useState(false);
  const [studentLoanPlan, setStudentLoanPlan] = useState('plan2');
  const [subRegion, setSubRegion] = useState<string | null>(null);
  const [filingStatus, setFilingStatus] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(() => Boolean(user));
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [managingBilling, setManagingBilling] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const countryConfig = getCountryConfig(country || 'UK');
  const currencySymbol = countryConfig.currencySymbol;

  const planLabel = subscription.plan === 'lifetime' ? 'Lifetime' : subscription.plan === 'plus' ? 'Plus' : 'Free';
  const needsBillingReview = subscription.needsBillingReview === true;
  const stripeEnvironment = getStripeEnvironment();
  const hasManageableBilling = (isPremium && subscription.plan !== 'lifetime') || needsBillingReview;
  const canManageBilling = hasManageableBilling && !!stripeEnvironment;

  const handleManageBilling = async () => {
    if (!stripeEnvironment) {
      toast({
        title: 'Billing is unavailable',
        description: 'We cannot open billing details right now. Please try again later.',
        variant: 'destructive',
      });
      return;
    }
    setManagingBilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          returnUrl: window.location.href,
          environment: stripeEnvironment,
        },
      });
      if (error || !data?.url) {
        toast({ title: 'Error', description: 'Unable to open billing portal. Please try again.', variant: 'destructive' });
      } else {
        // The Stripe portal runs on another origin. Do not leave it a handle
        // back to the authenticated app tab.
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
    setManagingBilling(false);
  };

  useEffect(() => {
    let active = true;

    if (!user) {
      setProfileLoading(false);
      setProfileLoadError(false);
      return () => { active = false; };
    }

    setProfileLoading(true);
    setProfileLoadError(false);

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (!active) return;

        if (error || !data) {
          setProfileLoadError(true);
          return;
        }

        setFirstName(data.first_name || '');
        const savedCountry = data.country as CountryCode | null;
        setCountry(isLaunchCountry(savedCountry) ? savedCountry : '');
        setAnnualSalary(data.annual_salary ? String(data.annual_salary) : '');
        setFrequency(data.pay_frequency || 'monthly');
        setEmployer(data.employer_name || '');
        setPayrollEmail(data.payroll_email || '');
        setHasPension(!!data.has_pension);
        setPensionPercent(data.pension_percent ? String(data.pension_percent) : '5');
        setHasStudentLoan(!!data.has_student_loan);
        setStudentLoanPlan(data.student_loan_plan || 'plan2');
        setSubRegion((data as { sub_region?: string | null }).sub_region ?? null);
        setFilingStatus((data as { filing_status?: string | null }).filing_status ?? null);
        setThreshold(data.anomaly_threshold_percent != null ? Number(data.anomaly_threshold_percent) : 5);
      } catch {
        if (active) setProfileLoadError(true);
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    void loadProfile();
    return () => { active = false; };
  }, [user, profileLoadAttempt]);

  // Reset sub-region / filing status when country changes to one without them
  useEffect(() => {
    if (!countryConfig.subRegions) setSubRegion(null);
    if (!countryConfig.filingStatuses) setFilingStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const handleSave = async () => {
    if (!user) return;
    if (!country) {
      toast({
        title: 'Choose a launch country',
        description: 'Payslip Insights is currently available for UK and Ireland employees.',
        variant: 'destructive',
      });
      return;
    }
    if (profileLoading || profileLoadError) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          country,
          currency: getCountryConfig(country).currency,
          annual_salary: annualSalary ? Number(annualSalary) : null,
          pay_frequency: frequency,
          employer_name: employer,
          payroll_email: payrollEmail || null,
          has_pension: hasPension,
          pension_percent: hasPension && pensionPercent ? Number(pensionPercent) : null,
          has_student_loan: hasStudentLoan,
          student_loan_plan: hasStudentLoan ? studentLoanPlan : null,
          sub_region: countryConfig.subRegions ? subRegion : null,
          filing_status: countryConfig.filingStatuses ? filingStatus : null,
          anomaly_threshold_percent: threshold,
        })
        .eq('user_id', user.id);
      if (error) {
        toast({ title: 'Settings not saved', description: 'We could not save your settings. Please try again.', variant: 'destructive' });
      } else {
        toast({ title: 'Settings saved', description: 'Your profile has been updated.' });
      }
    } catch {
      toast({ title: 'Settings not saved', description: 'We could not save your settings. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const results = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('payslips').select('*').eq('user_id', user.id).order('pay_date'),
        // Keep the tenant predicate in the database query as well as the
        // defensive export-row check below. A browser must never receive
        // another account's extraction or anomaly and then merely discard it.
        supabase.from('payslip_extractions').select('*, payslips!inner(user_id)').eq('payslips.user_id', user.id),
        supabase.from('anomaly_results').select('*, payslips!inner(user_id)').eq('payslips.user_id', user.id),
        supabase.from('user_notes').select('*').eq('user_id', user.id),
        supabase.from('issue_drafts').select('*').eq('user_id', user.id),
        supabase.from('employers').select('*').eq('user_id', user.id),
        supabase
          .from('payday_plans')
          .select('*, payday_plan_allocations(*)')
          .eq('user_id', user.id)
          .order('pay_date'),
      ]);

      const [profileResult, payslipsResult, extractionsResult, anomaliesResult, notesResult, draftsResult, employersResult, paydayPlansResult] = results;
      const profile = exportDataOrThrow(profileResult);
      const payslips = exportDataOrThrow(payslipsResult);
      const extractions = exportDataOrThrow(extractionsResult);
      const anomalies = exportDataOrThrow(anomaliesResult);
      const notes = exportDataOrThrow(notesResult);
      const drafts = exportDataOrThrow(draftsResult);
      const empData = exportDataOrThrow(employersResult);
      const paydayPlans = exportDataOrThrow(paydayPlansResult);

      const cleanExtractions = rowsForExport(extractions)
        .filter((extraction) => exportRowOwnerId(extraction) === user.id)
        .map(({ payslips: _payslip, ...rest }) => rest);
      const cleanAnomalies = rowsForExport(anomalies)
        .filter((anomaly) => exportRowOwnerId(anomaly) === user.id)
        .map(({ payslips: _payslip, ...rest }) => rest);

      const exportData = {
        exported_at: new Date().toISOString(),
        account_email: user.email,
        profile,
        employers: empData ?? [],
        payslips: payslips ?? [],
        extractions: cleanExtractions,
        anomalies: cleanAnomalies,
        notes: notes ?? [],
        issue_drafts: drafts ?? [],
        payday_plans: paydayPlans ?? [],
        tax_review_progress: exportTaxReviewProgress(
          browserTaxReviewProgressStorage(),
          user.id,
        ),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-insights-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Data exported', description: 'Your data has been downloaded as a JSON file.' });
    } catch {
      toast({ title: 'Export failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
    setExporting(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE' || !user) return;
    setDeleting(true);
    let billingReviewRequired = false;
    try {
      ({ billingReviewRequired } = await deleteCurrentUserAccount(supabase as never));
    } catch (error) {
      if (error instanceof AccountDeletionPendingError) {
        toast({ title: 'Deletion scheduled', description: error.message });
        setDeleting(false);
        setDeleteOpen(false);
        return;
      }
      const description = error instanceof AccountDeletionBlockedError
        ? error.message
        : 'Something went wrong. Please try again or contact support.';
      toast({ title: 'Deletion failed', description, variant: 'destructive' });
      setDeleting(false);
      setDeleteOpen(false);
      return;
    }

    clearTaxReviewProgress(browserTaxReviewProgressStorage(), user.id);

    if (billingReviewRequired) {
      toast({
        title: 'Account removed',
        description: 'Your app data has been removed. A recent payment needs a manual follow-up; please contact support.',
      });
    }

    // Once the deletion request is accepted, a local sign-out failure must not
    // tell someone that their deletion failed. Leave the authenticated page
    // regardless; the server remains the source of truth for the request.
    try {
      await signOut();
    } catch {
      // Navigation still removes this sensitive screen after a confirmed delete.
    }
    navigate('/', { replace: true });
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch {
      toast({
        title: 'Could not sign out',
        description: 'Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <TooltipProvider>
      <AppLayout>
        <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile, preferences, and data</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Plan & usage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {planLabel} plan
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPremium
                    ? subscription.cancelAtPeriodEnd
                      ? `Access until ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'period end'}`
                      : subscription.plan === 'lifetime'
                        ? `One payment — no renewal · up to ${uploadLimit} automatic checks and ${draftLimit} payroll-message drafts per calendar month`
                        : `Up to ${uploadLimit} automatic checks and ${draftLimit} payroll-message drafts per calendar month`
                    : needsBillingReview
                      ? 'We found an existing billing record. Manage it while we finish checking the account.'
                      : '2 automatic checks total and 2 payroll-message drafts per calendar month'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManageBilling && (
                  <Button variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={handleManageBilling} disabled={managingBilling}>
                    <ExternalLink className="h-3.5 w-3.5" /> {managingBilling ? 'Opening…' : 'Manage billing'}
                  </Button>
                )}
                {hasManageableBilling && !stripeEnvironment && (
                  <p className="max-w-48 text-xs text-muted-foreground">
                    Billing details are temporarily unavailable.
                  </p>
                )}
                {!isPremium && !needsBillingReview && (
                  <Button asChild size="sm" className="min-h-11 gap-1.5">
                    <Link to="/pricing">
                      <Sparkles className="h-3.5 w-3.5" /> Upgrade
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            {!isPremium && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Automatic checks</span>
                    <span>{automaticChecksUsed}/{uploadLimit} used</span>
                  </div>
                  <div
                    aria-label="Automatic checks used on the Free plan"
                    aria-valuemax={uploadLimit}
                    aria-valuemin={0}
                    aria-valuenow={automaticChecksUsed}
                    className="h-2 rounded-full bg-muted overflow-hidden"
                    role="progressbar"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${uploadsRemaining === 0 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${(automaticChecksUsed / uploadLimit) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Drafts</span>
                    <span>{limits.drafts_per_month - draftsRemaining}/{limits.drafts_per_month} used</span>
                  </div>
                  <div
                    aria-label="Payroll-message drafts used this month"
                    aria-valuemax={limits.drafts_per_month}
                    aria-valuemin={0}
                    aria-valuenow={limits.drafts_per_month - draftsRemaining}
                    className="h-2 rounded-full bg-muted overflow-hidden"
                    role="progressbar"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${draftsRemaining === 0 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${((limits.drafts_per_month - draftsRemaining) / limits.drafts_per_month) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {profileLoading && (
              <p className="text-sm text-muted-foreground" role="status">Loading your saved settings…</p>
            )}
            {profileLoadError && (
              <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
                <p className="text-sm text-foreground">We could not load your saved settings. Your profile has not been changed.</p>
                <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" onClick={() => setProfileLoadAttempt((attempt) => attempt + 1)}>
                  Retry loading settings
                </Button>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settings-first-name">First name</Label>
                <Input
                  id="settings-first-name"
                  className="min-h-11"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium leading-none">Country</legend>
                <div className="grid grid-cols-2 gap-2">
                  {LAUNCH_COUNTRY_LIST.map((c) => {
                    const inputId = `settings-country-${c.code.toLowerCase()}`;
                    return (
                      <div key={c.code}>
                        <input
                          id={inputId}
                          type="radio"
                          name="settings-country"
                          value={c.code}
                          checked={country === c.code}
                          onChange={() => setCountry(c.code)}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={inputId}
                          className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm leading-normal transition-all peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ${country === c.code ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground'}`}
                        >
                          {c.flag} {c.code === 'UK' ? 'UK' : c.name}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                {!country && (
                  <p className="text-xs text-muted-foreground" role="status">
                    Choose UK or Ireland to update your payroll profile. Other countries are not available in this launch.
                  </p>
                )}
              </fieldset>
            </div>
            {countryConfig.subRegions && countryConfig.subRegions.length > 0 && (
              <div className="space-y-2">
                <Label id="settings-sub-region-label" htmlFor="settings-sub-region">
                  {countryConfig.subRegionLabel ?? 'Region'}
                </Label>
                <Select value={subRegion ?? ''} onValueChange={setSubRegion}>
                  <SelectTrigger id="settings-sub-region" aria-labelledby="settings-sub-region-label" className="min-h-11">
                    <SelectValue placeholder={`Select ${(countryConfig.subRegionLabel ?? 'region').toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {countryConfig.subRegions.map((s) => (
                      <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {countryConfig.filingStatuses && countryConfig.filingStatuses.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium leading-none">{countryConfig.filingStatusLabel ?? 'Filing status'}</legend>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${countryConfig.filingStatuses.length}, minmax(0, 1fr))` }}>
                  {countryConfig.filingStatuses.map((f) => {
                    const inputId = `settings-filing-status-${f.code}`;
                    return (
                      <div key={f.code}>
                        <input
                          id={inputId}
                          type="radio"
                          name="settings-filing-status"
                          value={f.code}
                          checked={filingStatus === f.code}
                          onChange={() => setFilingStatus(f.code)}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={inputId}
                          className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm leading-normal transition-all peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ${filingStatus === f.code ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground'}`}
                        >
                          {f.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none">Pay frequency</legend>
              <div className="grid grid-cols-4 gap-2">
                {['weekly', 'fortnightly', 'monthly', 'other'].map((f) => {
                  const inputId = `settings-frequency-${f}`;
                  return (
                    <div key={f}>
                      <input
                        id={inputId}
                        type="radio"
                        name="settings-pay-frequency"
                        value={f}
                        checked={frequency === f}
                        onChange={() => setFrequency(f)}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={inputId}
                        className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-xs capitalize leading-normal transition-all peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ${frequency === f ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground'}`}
                      >
                        {f}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="settings-annual-salary">Annual gross salary ({currencySymbol})</Label>
              <Input
                id="settings-annual-salary"
                type="number"
                min="0"
                step="500"
                placeholder="e.g. 45000"
                value={annualSalary}
                onChange={(e) => setAnnualSalary(e.target.value)}
                className="min-h-11"
                aria-describedby="settings-annual-salary-help"
              />
              <p id="settings-annual-salary-help" className="text-xs text-muted-foreground">Used to calculate your in-app estimate. See the Privacy Policy for current data-handling details.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Deductions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-h-11 items-center justify-between gap-4">
              <div>
                <Label id="settings-pension-label" htmlFor="settings-has-pension" className="cursor-pointer text-sm text-foreground">
                  Pension contribution
                </Label>
                <p className="text-xs text-muted-foreground">Include pension deduction in estimates</p>
              </div>
              <Switch
                id="settings-has-pension"
                aria-labelledby="settings-pension-label"
                checked={hasPension}
                onCheckedChange={setHasPension}
                className="h-11 w-[3.25rem] shrink-0 p-1 [&>span]:h-7 [&>span]:w-7 data-[state=checked]:[&>span]:translate-x-3"
              />
            </div>
            {hasPension && (
              <div className="space-y-2 pl-0">
                <Label htmlFor="settings-pension-percent">Contribution percentage (%)</Label>
                <Input
                  id="settings-pension-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="5"
                  value={pensionPercent}
                  onChange={(e) => setPensionPercent(e.target.value)}
                  className="min-h-11 max-w-32"
                />
              </div>
            )}

            {country === 'UK' && (
              <>
                <Separator />
                <div className="flex min-h-11 items-center justify-between gap-4">
                  <div>
                    <Label id="settings-student-loan-label" htmlFor="settings-has-student-loan" className="cursor-pointer text-sm text-foreground">
                      Student loan
                    </Label>
                    <p className="text-xs text-muted-foreground">Include student loan repayment in estimates</p>
                  </div>
                  <Switch
                    id="settings-has-student-loan"
                    aria-labelledby="settings-student-loan-label"
                    checked={hasStudentLoan}
                    onCheckedChange={setHasStudentLoan}
                    className="h-11 w-[3.25rem] shrink-0 p-1 [&>span]:h-7 [&>span]:w-7 data-[state=checked]:[&>span]:translate-x-3"
                  />
                </div>
                {hasStudentLoan && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium leading-none">Repayment plan</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {STUDENT_LOAN_PLANS.map((plan) => {
                        const inputId = `settings-student-loan-${plan.value}`;
                        return (
                          <div key={plan.value}>
                            <input
                              id={inputId}
                              type="radio"
                              name="settings-student-loan-plan"
                              value={plan.value}
                              checked={studentLoanPlan === plan.value}
                              onChange={() => setStudentLoanPlan(plan.value)}
                              className="peer sr-only"
                            />
                            <Label
                              htmlFor={inputId}
                              className={`flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 text-left leading-normal transition-all peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ${
                                studentLoanPlan === plan.value
                                  ? 'border-primary bg-primary/5 text-primary'
                                  : 'border-border text-muted-foreground'
                              }`}
                            >
                              <span className="text-sm font-medium">{plan.label}</span>
                              <span className="block text-xs opacity-70">{plan.desc}</span>
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-1.5">
              Anomaly sensitivity
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="How anomaly sensitivity works"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  The minimum % change in your gross or net pay (vs. last payslip) that triggers an alert. Lower = more sensitive (more alerts); higher = only big swings. <strong>5% is recommended</strong>.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="threshold">Change threshold</Label>
              <span className="text-lg font-bold text-primary tabular-nums">{threshold}%</span>
            </div>
            <input
              id="threshold"
              type="range"
              min={1}
              max={25}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="min-h-11 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>1% — very sensitive</span>
              <span>5% — recommended</span>
              <span>25% — only big changes</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Employer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-employer-name">Employer name</Label>
              <Input
                id="settings-employer-name"
                className="min-h-11"
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-payroll-email">Payroll / HR email</Label>
              <Input
                id="settings-payroll-email"
                className="min-h-11"
                type="email"
                value={payrollEmail}
                onChange={(e) => setPayrollEmail(e.target.value)}
                placeholder="payroll@company.com"
                aria-describedby="settings-payroll-email-help"
              />
              <p id="settings-payroll-email-help" className="text-xs text-muted-foreground">Used to pre-fill the "To" field when drafting payroll queries.</p>
            </div>
          </CardContent>
        </Card>

        <Button className="min-h-11" onClick={handleSave} disabled={loading || profileLoading || profileLoadError}>
          {loading ? 'Saving…' : profileLoading ? 'Loading settings…' : 'Save changes'}
        </Button>

        <Separator />

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> How Payslip Insights works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="upload">
                <AccordionTrigger className="min-h-11 text-left text-sm">How do I upload a payslip?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Go to the Payslip Vault and drag & drop a PDF or image of your payslip. We'll extract the key figures automatically and compare them against your profile.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="anomalies">
                <AccordionTrigger className="min-h-11 text-left text-sm">What are anomalies?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Anomalies are changes or figures worth checking — like a sudden tax increase, a missing deduction, or a drop in net pay. Each one includes an explanation and a suggested next step.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="advice">
                <AccordionTrigger className="min-h-11 text-left text-sm">Is Payslip Insights tax advice?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  No. Payslip Insights provides guidance and issue spotting to help you understand your payslips. Our findings are not formal tax, legal, or payroll advice. Always confirm with your employer or a qualified professional.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="security">
                <AccordionTrigger className="min-h-11 text-left text-sm">How is my data handled?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  We use authenticated accounts and technical controls intended to limit access to customer data. To provide document processing, your payslip or the information needed to process it may be sent to configured providers. Read the Privacy Policy for current details on providers, access, retention, and deletion.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Separator />

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Privacy & security</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We handle your payslip, extracted figures, and saved preferences to provide the service. Configured providers may process document information. Read the Privacy Policy for current details; Payslip Insights provides guidance and issue spotting, not formal tax, legal, or payroll advice.
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              <a
                href="/privacy"
                className="inline-flex min-h-11 items-center rounded-md px-1 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="inline-flex min-h-11 items-center rounded-md px-1 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Terms of Service
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={openCookiePreferences}
              >
                Cookie preferences
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Your data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Download my data</p>
                <p className="text-xs text-muted-foreground">Export your payslips, payday plans, profile, and saved issue data as JSON.</p>
              </div>
              <Button variant="outline" size="sm" className="min-h-11 gap-2" onClick={handleExportData} disabled={exporting}>
                <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base text-destructive">Danger zone</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Sign out</p>
                <p className="text-xs text-muted-foreground">Sign out of your account on this device.</p>
              </div>
              <Button variant="outline" size="sm" className="min-h-11" disabled={signingOut} onClick={() => void handleSignOut()}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Delete account</p>
                <p className="text-xs text-muted-foreground">Request account deletion and removal of stored payslips. This cannot be undone once completed.</p>
              </div>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="min-h-11 gap-2">
                    <Trash2 className="h-4 w-4" /> Delete account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete your Payslip Insights account?</DialogTitle>
                    <DialogDescription asChild>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <p>This starts deletion of:</p>
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                          <li>Your profile and settings</li>
                          <li>All uploaded payslips and extracted data</li>
                          <li>All anomaly results and issue drafts</li>
                          <li>Your employer records</li>
                          <li>Tax-review progress saved on this browser</li>
                        </ul>
                        <p className="font-medium text-destructive">Once completed, this action cannot be undone.</p>
                        <Label htmlFor="delete-account-confirmation" className="text-sm text-foreground">
                          Type <strong>DELETE</strong> to confirm:
                        </Label>
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    id="delete-account-confirmation"
                    className="min-h-11"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="Type DELETE to confirm"
                  />
                  <DialogFooter>
                    <Button className="min-h-11" variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }}>Cancel</Button>
                    <Button
                      variant="destructive"
                      className="min-h-11"
                      disabled={deleteConfirm !== 'DELETE' || deleting}
                      onClick={handleDeleteAccount}
                    >
                      {deleting ? 'Deleting…' : 'Delete my account'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
        </div>
      </AppLayout>
    </TooltipProvider>
  );
};

export default Settings;
