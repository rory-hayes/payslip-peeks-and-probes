/**
 * IMPLEMENTATION NOTES (internal / admin reference):
 *
 * Custom Domain:
 *   - This app is intended to run on a custom primary domain (e.g. paycheck.app).
 *   - Configure the domain via Project Settings → Domains in the Lovable dashboard.
 *   - All internal references use the "PayCheck" brand — no platform references leak to users.
 *
 * Branded Sender Email Domain:
 *   - Auth and transactional emails should be sent from a branded domain (e.g. notify@paycheck.app).
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
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [loading, setLoading] = useState(false);
  const currencySymbol = country === 'Ireland' ? '€' : '£';

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
      })
      .eq('user_id', user.id);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved', description: 'Your profile has been updated.' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
        </div>

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
            {/* Pension */}
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

            {/* Student loan (UK only) */}
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
              <Input type="email" value={payrollEmail} onChange={(e) => setPayrollEmail(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : 'Save changes'}
        </Button>

        <Separator />

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Privacy & security</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your payslip data is encrypted and stored securely. Only you can access it. PayCheck provides guidance and issue spotting — not formal tax, legal, or payroll advice.
            </p>
            <div className="flex gap-4 text-xs">
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Delete account</p>
                <p className="text-xs text-muted-foreground">Permanently delete your account and all stored payslips.</p>
              </div>
              <Button variant="destructive" size="sm">Delete account</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
