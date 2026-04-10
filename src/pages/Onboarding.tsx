import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ArrowRight, ArrowLeft, Upload, Sparkles } from 'lucide-react';

const steps = ['Welcome', 'Country', 'Pay profile', 'Payroll details', 'Ready'];

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState<'UK' | 'Ireland' | ''>('');
  const [frequency, setFrequency] = useState('monthly');
  const [employer, setEmployer] = useState('');
  const [payrollEmail, setPayrollEmail] = useState('');
  const [flags, setFlags] = useState({ pension: false, studentLoan: false, bonus: false, benefits: false });

  const progress = ((step + 1) / steps.length) * 100;
  const canNext = step === 0 || (step === 1 && country) || (step === 2 && employer) || step === 3 || step === 4;

  const next = () => { if (step < steps.length - 1) setStep(step + 1); };
  const back = () => { if (step > 0) setStep(step - 1); };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <CheckCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">PayCheck</span>
          </div>
          <span className="text-xs text-muted-foreground">Step {step + 1} of {steps.length}</span>
        </div>
      </div>
      <Progress value={progress} className="h-1 rounded-none" />

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg border-0 shadow-lg">
          <CardContent className="p-8">
            {step === 0 && (
              <div className="text-center space-y-4 animate-fade-in">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Welcome to PayCheck</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We'll help you understand your payslips, track changes month to month, and raise issues quickly. Let's set up your profile — it only takes a minute.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-foreground">Where are you employed?</h2>
                  <p className="mt-2 text-sm text-muted-foreground">We tailor checks based on your country's tax system.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(['UK', 'Ireland'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCountry(c)}
                      className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${country === c ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}
                    >
                      <span className="text-4xl">{c === 'UK' ? '🇬🇧' : '🇮🇪'}</span>
                      <span className="font-medium text-foreground">{c === 'UK' ? 'United Kingdom' : 'Ireland'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-foreground">Your pay profile</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Tell us a bit about how you're paid.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pay frequency</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {['weekly', 'fortnightly', 'monthly', 'other'].map((f) => (
                        <button
                          key={f}
                          onClick={() => setFrequency(f)}
                          className={`rounded-lg border px-3 py-2 text-sm capitalize transition-all ${frequency === f ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:border-muted-foreground/30'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employer">Employer name</Label>
                    <Input id="employer" placeholder="e.g. Acme Technologies Ltd" value={employer} onChange={(e) => setEmployer(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payroll-email">Payroll / HR email <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="payroll-email" type="email" placeholder="payroll@company.com" value={payrollEmail} onChange={(e) => setPayrollEmail(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-foreground">Payroll details</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Select any that apply — this helps us run smarter checks.</p>
                </div>
                <div className="space-y-3">
                  {[
                    { key: 'pension', label: 'Pension contributions' },
                    { key: 'studentLoan', label: 'Student loan repayment' },
                    { key: 'bonus', label: 'Bonus / commission' },
                    { key: 'benefits', label: 'Benefits in kind' },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={flags[item.key as keyof typeof flags]}
                        onCheckedChange={(v) => setFlags({ ...flags, [item.key]: v === true })}
                      />
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="text-center space-y-6 animate-fade-in">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-success/10">
                  <Upload className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">You're all set!</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Upload your first payslip and we'll extract the key figures, compare them with previous months, and flag anything that looks unusual.
                </p>
                <p className="text-xs text-muted-foreground">
                  Remember: PayCheck provides guidance and issue spotting — not formal tax or payroll advice.
                </p>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              {step > 0 ? (
                <Button variant="ghost" onClick={back} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              ) : <div />}
              {step < steps.length - 1 ? (
                <Button onClick={next} disabled={!canNext} className="gap-1">
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => navigate('/dashboard')} className="gap-1">
                  Upload your first payslip <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
