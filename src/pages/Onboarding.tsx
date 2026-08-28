import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, ArrowLeft, Upload, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  LAUNCH_COUNTRY_LIST,
  getCountryConfig,
  type LaunchCountryCode,
} from '@/lib/countries';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { BrandLockup } from '@/components/BrandLockup';
import {
  checkoutPathForPrice,
  checkoutReturnPathForSession,
  getCheckoutPriceId,
  getCheckoutReturnSessionId,
} from '@/lib/checkout-price';

const STEPS = ['Welcome', 'Country', 'Pay profile', 'Sensitivity', 'Payroll setup', 'Ready'] as const;

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState<LaunchCountryCode | ''>('');
  const [subRegion, setSubRegion] = useState<string>('');
  const [filingStatus, setFilingStatus] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('');
  const [employer, setEmployer] = useState('');
  const [annualSalary, setAnnualSalary] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(5);
  const [flags, setFlags] = useState({ pension: false, studentLoan: false, bonus: false, benefits: false });
  const [saving, setSaving] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const checkoutPriceId = getCheckoutPriceId(searchParams.get('checkout'));
  const checkoutReturnSessionId = getCheckoutReturnSessionId(searchParams.get('checkout_return'));
  const checkoutPath = checkoutReturnSessionId
    ? checkoutReturnPathForSession(checkoutReturnSessionId)
    : checkoutPriceId
      ? checkoutPathForPrice(checkoutPriceId)
      : null;

  const progress = ((step + 1) / STEPS.length) * 100;

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [step]);

  const countryCfgEarly = country ? getCountryConfig(country) : null;
  const needsSubRegion = !!countryCfgEarly?.subRegions?.length;
  const needsFilingStatus = !!countryCfgEarly?.filingStatuses?.length;

  const canNext = (() => {
    if (step === 0) return true;
    if (step === 1) {
      if (!country) return false;
      if (needsSubRegion && !subRegion) return false;
      if (needsFilingStatus && !filingStatus) return false;
      return true;
    }
    if (step === 2) return !!frequency && employer.trim().length > 0;
    if (step === 3) return threshold >= 1 && threshold <= 25;
    if (step === 4) return true;
    if (step === 5) return true;
    return false;
  })();
  const payProfileRequirementsMessage = !frequency && !employer.trim()
    ? 'Choose a pay frequency and enter your employer name to continue.'
    : !frequency
      ? 'Choose a pay frequency to continue.'
      : !employer.trim()
        ? 'Enter your employer name to continue.'
        : '';

  const next = () => { if (canNext && step < STEPS.length - 1) setStep(step + 1); };
  const back = () => { if (step > 0) setStep(step - 1); };

  const handleCountrySelect = (code: LaunchCountryCode) => {
    setCountry(code);
    const cfg = getCountryConfig(code);
    setSubRegion(cfg.subRegions?.[0]?.code ?? '');
    setFilingStatus(cfg.filingStatuses?.[0]?.code ?? '');
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const cfg = country ? getCountryConfig(country) : null;
      const parsedSalary = annualSalary.trim() ? Number(annualSalary.replace(/[^0-9.]/g, '')) : null;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          country: country || null,
          currency: cfg?.currency ?? 'GBP',
          sub_region: needsSubRegion ? (subRegion || null) : null,
          filing_status: needsFilingStatus ? (filingStatus || null) : null,
          pay_frequency: frequency,
          employer_name: employer.trim(),
          annual_salary: parsedSalary && parsedSalary > 0 ? parsedSalary : null,
          anomaly_threshold_percent: threshold,
          has_pension: flags.pension,
          has_student_loan: flags.studentLoan,
          has_bonus: flags.bonus,
          has_benefits: flags.benefits,
          onboarding_complete: true,
        })
        .eq('user_id', user.id);

      if (profileError) {
        toast({
          title: 'We couldn’t finish setup',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      if (employer.trim()) {
        const { error: employerError } = await supabase.from('employers').insert({
          user_id: user.id,
          name: employer.trim(),
        });
        if (employerError) {
          // The profile is already saved, so do not trap a person in setup for
          // optional employer history. Make the partial save explicit instead.
          toast({
            title: 'Setup saved',
            description: 'Your profile is ready. You can update your employer later in Settings.',
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      navigate(checkoutPath ?? '/vault');
    } catch {
      toast({
        title: 'We couldn’t finish setup',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true })
        .eq('user_id', user.id);
      if (error) {
        toast({
          title: 'We couldn’t finish setup',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      navigate(checkoutPath ?? '/dashboard');
    } catch {
      toast({
        title: 'We couldn’t finish setup',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const countryCfg = country ? getCountryConfig(country) : null;
  const countryLabel = countryCfg?.name ?? '—';
  const currencyLabel = countryCfg ? `${countryCfg.currency} (${countryCfg.currencySymbol})` : 'GBP (£)';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLockup size="sm" />
          </div>
          <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
        </div>
      </div>
      <Progress value={progress} className="h-1 rounded-none" aria-label={`Onboarding progress: step ${step + 1} of ${STEPS.length}`} />

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <Card className="w-full max-w-lg border-0 shadow-lg">
          <CardContent className="p-6 sm:p-8">

            {/* Step 0 — Welcome */}
            {step === 0 && (
              <div className="text-center space-y-4">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h1 ref={stepHeadingRef} tabIndex={-1} className="text-2xl font-bold text-foreground">Welcome to Payslip Insights</h1>
                <p className="text-muted-foreground leading-relaxed">
                  Upload your payslips, track changes month to month, and get a heads-up when something looks off. Let's get your profile set up — it takes less than a minute.
                </p>
              </div>
            )}

            {/* Step 1 — Country */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 ref={stepHeadingRef} tabIndex={-1} className="text-2xl font-bold text-foreground">Where are you employed?</h1>
                  <p className="mt-2 text-sm text-muted-foreground">This sets your currency and tax rules.</p>
                </div>
                <div className="grid grid-cols-2 gap-3" role="group" aria-label="Country of employment">
                  {LAUNCH_COUNTRY_LIST.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      aria-pressed={country === c.code}
                      onClick={() => handleCountrySelect(c.code)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        country === c.code
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className="text-3xl">{c.flag}</span>
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                      <span className="text-[11px] text-muted-foreground">{c.currency} ({c.currencySymbol})</span>
                    </button>
                  ))}
                </div>

                {country && (needsSubRegion || needsFilingStatus) && (
                  <div className="space-y-4 rounded-xl border border-border p-4 bg-muted/30">
                    {needsSubRegion && (
                      <div className="space-y-2">
                        <Label htmlFor="subRegion">
                          {countryCfgEarly?.subRegionLabel ?? 'Region'} <span className="text-destructive">*</span>
                        </Label>
                        <select
                          id="subRegion"
                          value={subRegion}
                          onChange={(e) => setSubRegion(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          <option value="">Select…</option>
                          {countryCfgEarly?.subRegions?.map((r) => (
                            <option key={r.code} value={r.code}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {needsFilingStatus && (
                      <div className="space-y-2">
                        <Label htmlFor="filingStatus">
                          {countryCfgEarly?.filingStatusLabel ?? 'Filing status'} <span className="text-destructive">*</span>
                        </Label>
                        <div className="grid grid-cols-1 gap-2" role="group" aria-label={countryCfgEarly?.filingStatusLabel ?? 'Filing status'}>
                          {countryCfgEarly?.filingStatuses?.map((fs) => (
                            <button
                              key={fs.code}
                              type="button"
                              aria-pressed={filingStatus === fs.code}
                              onClick={() => setFilingStatus(fs.code)}
                              className={`text-left rounded-lg border px-3 py-2.5 text-sm transition-all ${
                                filingStatus === fs.code
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-muted-foreground/30'
                              }`}
                            >
                              <span className="font-medium text-foreground">{fs.label}</span>
                              {fs.description && (
                                <span className="block text-xs text-muted-foreground mt-0.5">{fs.description}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Used to calculate your expected take-home. You can change this later in Settings.
                    </p>
                  </div>
                )}

                <p className="text-xs text-center text-muted-foreground pt-1">
                  Payslip Insights is currently available for UK and Ireland employees.
                </p>
              </div>
            )}

            {/* Step 2 — Pay profile */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 ref={stepHeadingRef} tabIndex={-1} className="text-2xl font-bold text-foreground">Your pay profile</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Tell us how you're paid so we can run the right checks.</p>
                </div>
                <div className="space-y-4">
                  <fieldset className="space-y-2" aria-describedby="pay-profile-requirements">
                    <legend className="text-sm font-medium leading-none">Pay frequency <span className="text-destructive">*</span></legend>
                    <div className="grid grid-cols-2 gap-2">
                      {['weekly', 'fortnightly', 'monthly', 'other'].map((f) => (
                        <div key={f}>
                          <input
                            id={`pay-frequency-${f}`}
                            type="radio"
                            name="pay-frequency"
                            value={f}
                            checked={frequency === f}
                            onChange={() => setFrequency(f)}
                            className="peer sr-only"
                            required
                          />
                          <Label
                            htmlFor={`pay-frequency-${f}`}
                            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm capitalize transition-all peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ${
                              frequency === f
                                ? 'border-primary bg-primary/5 text-primary font-medium'
                                : 'border-border text-muted-foreground hover:border-muted-foreground/30'
                            }`}
                          >
                            {f}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                  <div className="space-y-2">
                    <Label htmlFor="employer">Employer name <span className="text-destructive">*</span></Label>
                    <Input
                      id="employer"
                      autoComplete="organization"
                      aria-describedby="pay-profile-requirements"
                      aria-required="true"
                      placeholder="e.g. Acme Technologies Ltd"
                      value={employer}
                      onChange={(e) => setEmployer(e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>
                  <p id="pay-profile-requirements" className="min-h-5 text-xs text-muted-foreground" role="status" aria-live="polite">
                    {payProfileRequirementsMessage}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="annualSalary" className="flex items-center gap-1.5">
                      Annual gross salary
                      <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {countryCfg?.currencySymbol ?? '£'}
                      </span>
                      <Input
                        id="annualSalary"
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 45000"
                        value={annualSalary}
                        onChange={(e) => setAnnualSalary(e.target.value)}
                        className="pl-7"
                        maxLength={12}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Helps put your confirmed pay history in context. You can add this later in Settings; it is not a tax or payroll verdict.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Sensitivity */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 ref={stepHeadingRef} tabIndex={-1} className="text-2xl font-bold text-foreground">How sensitive should we be?</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We flag pay changes between payslips when they exceed your threshold.
                  </p>
                </div>

                <div className="rounded-xl border border-border p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="threshold" className="text-sm font-medium">Change threshold</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" aria-label="What is this?" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          The minimum % change in your gross or net pay that triggers an alert. A lower number flags more changes (more noise); a higher number only flags larger swings. <strong>5% is recommended</strong> — it catches meaningful shifts like tax-code changes without alerting on small overtime variations.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-2xl font-bold text-primary tabular-nums">{threshold}%</span>
                  </div>

                  <input
                    id="threshold"
                    type="range"
                    min={1}
                    max={25}
                    step={1}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full accent-primary"
                  />

                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>1% — very sensitive</span>
                    <span>5% — recommended</span>
                    <span>25% — only big changes</span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                    You can change this anytime in Settings. The threshold applies to month-on-month
                    comparisons of gross pay, net pay, and key deductions.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4 — Payroll setup */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 ref={stepHeadingRef} tabIndex={-1} className="text-2xl font-bold text-foreground">Payroll details</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Tick anything that applies — this helps us run smarter checks on your payslips.</p>
                </div>
                <div className="space-y-3">
                  {([
                    { key: 'pension' as const, label: 'Pension contributions', desc: 'Workplace or personal pension deductions' },
                    { key: 'studentLoan' as const, label: 'Student loan repayment', desc: 'UK Plan 1, 2, 4, 5, or postgrad' },
                    { key: 'bonus' as const, label: 'Bonus / commission', desc: 'Regular or one-off performance pay' },
                    { key: 'benefits' as const, label: 'Benefits in kind', desc: 'Company car, health insurance, etc.' },
                  ]).map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={flags[item.key]}
                        onCheckedChange={(v) => setFlags({ ...flags, [item.key]: v === true })}
                      />
                      <div>
                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5 — Ready / Summary */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-success/10">
                    <Upload className="h-8 w-8 text-success" />
                  </div>
                  <h1 ref={stepHeadingRef} tabIndex={-1} className="text-2xl font-bold text-foreground">You're all set!</h1>
                  <p className="text-muted-foreground leading-relaxed">
                    Here's what we captured. You can update any of this later in Settings.
                  </p>
                </div>

                <div className="rounded-lg border border-border divide-y divide-border text-sm">
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Country</span>
                    <span className="font-medium text-foreground">{countryLabel}</span>
                  </div>
                  {needsSubRegion && (
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-muted-foreground">{countryCfg?.subRegionLabel ?? 'Region'}</span>
                      <span className="font-medium text-foreground">
                        {countryCfg?.subRegions?.find((r) => r.code === subRegion)?.name ?? '—'}
                      </span>
                    </div>
                  )}
                  {needsFilingStatus && (
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-muted-foreground">{countryCfg?.filingStatusLabel ?? 'Filing status'}</span>
                      <span className="font-medium text-foreground">
                        {countryCfg?.filingStatuses?.find((f) => f.code === filingStatus)?.label ?? '—'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="font-medium text-foreground">{currencyLabel}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Pay frequency</span>
                    <span className="font-medium text-foreground capitalize">{frequency || '—'}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Employer</span>
                    <span className="font-medium text-foreground">{employer.trim() || '—'}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Annual salary</span>
                    <span className="font-medium text-foreground">
                      {annualSalary.trim()
                        ? `${countryCfg?.currencySymbol ?? '£'}${Number(annualSalary.replace(/[^0-9.]/g, '')).toLocaleString()}`
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-muted-foreground">Extras</span>
                    <span className="font-medium text-foreground text-right">
                      {[
                        flags.pension && 'Pension',
                        flags.studentLoan && 'Student loan',
                        flags.bonus && 'Bonus',
                        flags.benefits && 'Benefits',
                      ].filter(Boolean).join(', ') || 'None'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Payslip Insights provides guidance and issue spotting — not formal tax or payroll advice.
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between">
              {step > 0 ? (
                <Button variant="ghost" onClick={back} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={handleSkip} disabled={saving} className="text-muted-foreground">
                  Skip for now
                </Button>
              )}

              {step < STEPS.length - 1 ? (
                <Button
                  onClick={next}
                  disabled={!canNext}
                  className="gap-1"
                  aria-describedby={step === 2 && !canNext ? 'pay-profile-requirements' : undefined}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleFinish} disabled={saving} className="gap-1">
                  {saving ? 'Saving…' : 'Upload your first payslip'} <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Onboarding;
