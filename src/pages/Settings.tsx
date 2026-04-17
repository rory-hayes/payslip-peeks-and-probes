/**
 * IMPLEMENTATION NOTES (internal / admin reference):
 *
 * Custom Domain:
 *   - This app runs on the custom primary domain paycheckinsights.com.
 *   - Configure the domain via Project Settings → Domains in the Lovable dashboard.
 *   - All internal references use the "PayCheck" brand — no platform references leak to users.
 *
 * Branded Sender Email Domain:
 *   - Auth and transactional emails should be sent from a branded domain (e.g. notify@paycheckinsights.com).
 *   - Configure via Cloud → Emails in the Lovable dashboard.
 *
 * Google OAuth Credentials:
 *   - For full branding control on the Google consent screen, use your own Google OAuth
 *     client ID and secret. Configure via Cloud → Users → Auth Settings → Google.
 *   - This ensures users see "PayCheck" (not a third-party name) on the Google sign-in prompt.
 *
 * Stripe Billing:
 *   - When enabling Stripe, configure the PayCheck brand name, logo, and colours
 *     in the Stripe dashboard so checkout and invoices are fully branded.
 *
 * Favicon / Logo:
 *   - Replace /public/favicon.ico and add logo assets under /src/assets/ when ready.
 *   - Update the CheckCircle icon placeholder across all pages with the final logo component.
 */
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Trash2, HelpCircle, Sparkles, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STUDENT_LOAN_PLANS = [
  { value: 'plan1', label: 'Plan 1', desc: 'Started before Sep 2012 (England/Wales)' },
  { value: 'plan2', label: 'Plan 2', desc: 'Started Sep 2012 onwards (England/Wales)' },
  { value: 'plan4', label: 'Plan 4', desc: 'Scotland' },
  { value: 'plan5', label: 'Plan 5', desc: 'Started Aug 2023 onwards' },
  { value: 'postgrad', label: 'Postgraduate', desc: 'Postgraduate loan' },
];

const Settings = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const { uploadsRemaining, draftsRemaining, isPremium, limits } = useUsage();
  const [firstName, setFirstName] = useState('');
  const [country, setCountry] = useState<'UK' | 'Ireland'>('UK');
  const [annualSalary, setAnnualSalary] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [employer, setEmployer] = useState('');
  const [payrollEmail, setPayrollEmail] = useState('');
  const [hasPension, setHasPension] = useState(false);
  const [pensionPercent, setPensionPercent] = useState('5');
  const [hasStudentLoan, setHasStudentLoan] = useState(false);
  const [studentLoanPlan, setStudentLoanPlan] = useState('plan2');
  const [threshold, setThreshold] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [managingBilling, setManagingBilling] = useState(false);
  const currencySymbol = country === 'Ireland' ? '€' : '£';

  const planLabel = subscription.plan === 'lifetime' ? 'Lifetime' : subscription.plan === 'plus' ? 'Plus' : 'Free';

  const handleManageBilling = async () => {
    setManagingBilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          returnUrl: window.location.href,
          environment: getStripeEnvironment(),
        },
      });
      if (error || !data?.url) {
        toast({ title: 'Error', description: 'Unable to open billing portal. Please try again.', variant: 'destructive' });
      } else {
        window.open(data.url, '_blank');
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    }
    setManagingBilling(false);
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFirstName(data.first_name || '');
          setCountry((data.country as 'UK' | 'Ireland') || 'UK');
          setAnnualSalary(data.annual_salary ? String(data.annual_salary) : '');
          setFrequency(data.pay_frequency || 'monthly');
          setEmployer(data.employer_name || '');
          setPayrollEmail(data.payroll_email || '');
          setHasPension(!!data.has_pension);
          setPensionPercent(data.pension_percent ? String(data.pension_percent) : '5');
          setHasStudentLoan(!!data.has_student_loan);
          setStudentLoanPlan(data.student_loan_plan || 'plan2');
          setThreshold(data.anomaly_threshold_percent != null ? Number(data.anomaly_threshold_percent) : 5);
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        country,
        currency: country === 'Ireland' ? 'EUR' : 'GBP',
        annual_salary: annualSalary ? Number(annualSalary) : null,
        pay_frequency: frequency,
        employer_name: employer,
        payroll_email: payrollEmail || null,
        has_pension: hasPension,
        pension_percent: hasPension && pensionPercent ? Number(pensionPercent) : null,
        has_student_loan: hasStudentLoan,
        student_loan_plan: hasStudentLoan ? studentLoanPlan : null,
        anomaly_threshold_percent: threshold,
      })
      .eq('user_id', user.id);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved', description: 'Your profile has been updated.' });
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [
        { data: profile },
        { data: payslips },
        { data: extractions },
        { data: anomalies },
        { data: notes },
        { data: drafts },
        { data: empData },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('payslips').select('*').eq('user_id', user.id).order('pay_date'),
        supabase.from('payslip_extractions').select('*, payslips!inner(user_id)'),
        supabase.from('anomaly_results').select('*, payslips!inner(user_id)'),
        supabase.from('user_notes').select('*').eq('user_id', user.id),
        supabase.from('issue_drafts').select('*').eq('user_id', user.id),
        supabase.from('employers').select('*').eq('user_id', user.id),
      ]);

      // Strip the join column used for RLS filtering
      const cleanExtractions = (extractions ?? [])
        .filter((e: any) => e.payslips?.user_id === user.id)
        .map(({ payslips: _j, ...rest }: any) => rest);
      const cleanAnomalies = (anomalies ?? [])
        .filter((a: any) => a.payslips?.user_id === user.id)
        .map(({ payslips: _j, ...rest }: any) => rest);

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
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paycheck-export-${new Date().toISOString().split('T')[0]}.json`;
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
    try {
      // 0. Cancel any active Stripe subscriptions before deleting data
      if (subscription.isPremium && subscription.plan !== 'lifetime') {
        try {
          await supabase.functions.invoke('cancel-subscription-on-delete', {
            body: { environment: getStripeEnvironment() },
          });
        } catch (e) {
          console.error('Failed to cancel Stripe subscription:', e);
          // Continue with deletion even if Stripe cancel fails
        }
      }

      // 1. Get payslip file paths so we can delete from storage
      const { data: payslipFiles } = await supabase
        .from('payslips')
        .select('file_path')
        .eq('user_id', user.id);

      // 2. Delete storage files
      const paths = (payslipFiles ?? [])
        .map((p) => p.file_path)
        .filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from('payslips').remove(paths);
      }

      // 3. Delete database records (cascades handle extractions + anomalies)
      await Promise.all([
        supabase.from('user_notes').delete().eq('user_id', user.id),
        supabase.from('issue_drafts').delete().eq('user_id', user.id),
        supabase.from('audit_events').delete().eq('user_id', user.id),
        supabase.from('billing_subscriptions').delete().eq('user_id', user.id),
        supabase.from('employers').delete().eq('user_id', user.id),
      ]);

      // Payslips (cascade deletes extractions + anomaly_results)
      await supabase.from('payslips').delete().eq('user_id', user.id);

      // Profile last
      await supabase.from('profiles').delete().eq('user_id', user.id);

      // 4. Sign out and redirect
      await signOut();
      window.location.href = '/';
    } catch {
      toast({ title: 'Deletion failed', description: 'Something went wrong. Please try again or contact support.', variant: 'destructive' });
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile, preferences, and data</p>
        </div>

        {/* Plan & Usage */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Plan & usage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {planLabel} plan
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPremium
                    ? subscription.cancelAtPeriodEnd
                      ? `Access until ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'period end'}`
                      : subscription.plan === 'lifetime' ? 'Lifetime access — no renewal needed' : 'Unlimited uploads and drafts'
                    : 'Limited uploads and drafts per month'}
                </p>
              </div>
              <div className="flex gap-2">
                {isPremium && subscription.plan !== 'lifetime' && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleManageBilling} disabled={managingBilling}>
                    <ExternalLink className="h-3.5 w-3.5" /> {managingBilling ? 'Opening…' : 'Manage billing'}
                  </Button>
                )}
                {!isPremium && (
                  <Link to="/pricing">
                    <Button size="sm" className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Upgrade
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            {!isPremium && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Uploads</span>
                    <span>{limits.uploads_per_month - uploadsRemaining}/{limits.uploads_per_month} used</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${uploadsRemaining === 0 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${((limits.uploads_per_month - uploadsRemaining) / limits.uploads_per_month) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Drafts</span>
                    <span>{limits.drafts_per_month - draftsRemaining}/{limits.drafts_per_month} used</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['UK', 'Ireland'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCountry(c)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-all ${country === c ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground'}`}
                    >
                      {c === 'UK' ? '🇬🇧 UK' : '🇮🇪 Ireland'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pay frequency</Label>
              <div className="grid grid-cols-4 gap-2">
                {['weekly', 'fortnightly', 'monthly', 'other'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={`rounded-lg border px-2 py-2 text-xs capitalize transition-all ${frequency === f ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Annual gross salary ({currencySymbol})</Label>
              <Input
                type="number"
                min="0"
                step="500"
                placeholder="e.g. 45000"
                value={annualSalary}
                onChange={(e) => setAnnualSalary(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Used to estimate expected tax and net pay. Kept private.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Deductions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Pension contribution</p>
                <p className="text-xs text-muted-foreground">Include pension deduction in estimates</p>
              </div>
              <Switch checked={hasPension} onCheckedChange={setHasPension} />
            </div>
            {hasPension && (
              <div className="space-y-2 pl-0">
                <Label>Contribution percentage (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="5"
                  value={pensionPercent}
                  onChange={(e) => setPensionPercent(e.target.value)}
                  className="max-w-32"
                />
              </div>
            )}

            {country === 'UK' && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Student loan</p>
                    <p className="text-xs text-muted-foreground">Include student loan repayment in estimates</p>
                  </div>
                  <Switch checked={hasStudentLoan} onCheckedChange={setHasStudentLoan} />
                </div>
                {hasStudentLoan && (
                  <div className="space-y-2">
                    <Label>Repayment plan</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {STUDENT_LOAN_PLANS.map((plan) => (
                        <button
                          key={plan.value}
                          onClick={() => setStudentLoanPlan(plan.value)}
                          className={`rounded-lg border px-3 py-2 text-left transition-all ${
                            studentLoanPlan === plan.value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          <span className="text-sm font-medium">{plan.label}</span>
                          <span className="block text-xs opacity-70">{plan.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Employer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Employer name</Label>
              <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payroll / HR email</Label>
              <Input type="email" value={payrollEmail} onChange={(e) => setPayrollEmail(e.target.value)} placeholder="payroll@company.com" />
              <p className="text-xs text-muted-foreground">Used to pre-fill the "To" field when drafting payroll queries.</p>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : 'Save changes'}
        </Button>

        <Separator />

        {/* How it works */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> How PayCheck works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="upload">
                <AccordionTrigger className="text-sm">How do I upload a payslip?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Go to the Payslip Vault and drag & drop a PDF or image of your payslip. We'll extract the key figures automatically and compare them against your profile.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="anomalies">
                <AccordionTrigger className="text-sm">What are anomalies?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Anomalies are changes or issues we've flagged on your payslip — like a sudden tax increase, a missing deduction, or a drop in net pay. Each one includes an explanation and suggested next step.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="advice">
                <AccordionTrigger className="text-sm">Is PayCheck tax advice?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  No. PayCheck provides guidance and issue spotting to help you understand your payslips. Our findings are not formal tax, legal, or payroll advice. Always confirm with your employer or a qualified professional.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="security">
                <AccordionTrigger className="text-sm">Is my data secure?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Yes. Your payslip data is encrypted in transit and at rest. Only you can access your data — we never share it with third parties. You can export or delete your data at any time.
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
              Your payslip data is encrypted and stored securely. Only you can access it. PayCheck provides guidance and issue spotting — not formal tax, legal, or payroll advice.
            </p>
            <div className="flex gap-4 text-xs">
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Your data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Download my data</p>
                <p className="text-xs text-muted-foreground">Export all your payslips, profile, and anomaly data as JSON.</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportData} disabled={exporting}>
                <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base text-destructive">Danger zone</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Sign out</p>
                <p className="text-xs text-muted-foreground">Sign out of your account on this device.</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Delete account</p>
                <p className="text-xs text-muted-foreground">Permanently delete your account and all stored payslips. This cannot be undone.</p>
              </div>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" /> Delete account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete your PayCheck account?</DialogTitle>
                    <DialogDescription className="space-y-3">
                      <p>This will permanently delete:</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li>Your profile and settings</li>
                        <li>All uploaded payslips and extracted data</li>
                        <li>All anomaly results and issue drafts</li>
                        <li>Your employer records</li>
                      </ul>
                      <p className="font-medium text-destructive">This action cannot be undone.</p>
                      <p className="text-sm">Type <strong>DELETE</strong> to confirm:</p>
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="Type DELETE to confirm"
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }}>Cancel</Button>
                    <Button
                      variant="destructive"
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
  );
};

export default Settings;
