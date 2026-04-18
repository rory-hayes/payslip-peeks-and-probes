import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Info, Share2 } from 'lucide-react';
import { calculateExpectedMonthly } from '@/lib/tax-calculator';
import { getCountryConfig, COUNTRY_LIST, type CountryCode } from '@/lib/countries';
import { toast } from 'sonner';

interface NetPayCalculatorProps {
  country: CountryCode;
  /** When true, hides the country picker (used on /calculator/:country pages). */
  lockCountry?: boolean;
  /** Compact mode — used as embed inside guides. */
  compact?: boolean;
}

type StudentLoanPlan = 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgrad';

const NetPayCalculator = ({ country, lockCountry = false, compact = false }: NetPayCalculatorProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const config = getCountryConfig(country);

  // ── Initial state from query params (deep-linkable) ──────────
  const initialGross = (() => {
    const raw = searchParams.get('gross');
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
    if (country === 'UK') return 35000;
    if (country === 'US') return 75000;
    return 40000;
  })();
  const initialPension = Number(searchParams.get('pension') ?? '0');
  const initialStudentLoan = searchParams.get('studentLoan') as StudentLoanPlan | null;
  const initialState = searchParams.get('state');
  const initialFiling = searchParams.get('filing');

  const [gross, setGross] = useState<number>(initialGross);
  const [grossInput, setGrossInput] = useState<string>(String(initialGross));
  const [hasPension, setHasPension] = useState(initialPension > 0);
  const [pensionPercent, setPensionPercent] = useState<number>(initialPension > 0 ? initialPension : 5);
  const [hasStudentLoan, setHasStudentLoan] = useState<boolean>(country === 'UK' && !!initialStudentLoan);
  const [studentLoanPlan, setStudentLoanPlan] = useState<StudentLoanPlan>(initialStudentLoan ?? 'plan2');

  // Sub-region (US state, etc.) — default to first option for the country
  const defaultSubRegion = config.subRegions?.[0]?.code ?? null;
  const [subRegion, setSubRegion] = useState<string | null>(
    initialState && config.subRegions?.some((s) => s.code === initialState) ? initialState : defaultSubRegion,
  );

  // Filing status — default to first option for the country
  const defaultFiling = config.filingStatuses?.[0]?.code ?? null;
  const [filingStatus, setFilingStatus] = useState<string | null>(
    initialFiling && config.filingStatuses?.some((f) => f.code === initialFiling) ? initialFiling : defaultFiling,
  );

  // Reset sub-region / filing status when country changes (skip first render so URL params survive)
  const didMountForCountry = useRef(false);
  useEffect(() => {
    if (!didMountForCountry.current) {
      didMountForCountry.current = true;
      return;
    }
    setSubRegion(config.subRegions?.[0]?.code ?? null);
    setFilingStatus(config.filingStatuses?.[0]?.code ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const breakdown = useMemo(
    () =>
      calculateExpectedMonthly(gross, country, {
        pensionPercent: hasPension ? pensionPercent : 0,
        hasStudentLoan: country === 'UK' && hasStudentLoan,
        studentLoanPlan,
        subRegion,
        filingStatus,
      }),
    [gross, country, hasPension, pensionPercent, hasStudentLoan, studentLoanPlan, subRegion, filingStatus],
  );

  const fmt = (n: number) =>
    `${config.currencySymbol}${n.toLocaleString(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtAnnual = (n: number) =>
    `${config.currencySymbol}${(n * 12).toLocaleString(config.locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // ── Sync URL when the user changes inputs (debounced via simple effect) ──────────
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      next.set('gross', String(gross));
      if (hasPension) next.set('pension', String(pensionPercent));
      else next.delete('pension');
      if (country === 'UK' && hasStudentLoan) next.set('studentLoan', studentLoanPlan);
      else next.delete('studentLoan');
      if (config.subRegions && subRegion) next.set('state', subRegion);
      else next.delete('state');
      if (config.filingStatuses && filingStatus) next.set('filing', filingStatus);
      else next.delete('filing');
      setSearchParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gross, hasPension, pensionPercent, hasStudentLoan, studentLoanPlan, country, subRegion, filingStatus]);

  const effectiveTaxRate = gross > 0 ? ((breakdown.totalDeductions * 12) / gross) * 100 : 0;

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied — share your calculation');
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {/* Country switcher — hidden on per-country pages */}
      {!lockCountry && (
        <Tabs
          value={country}
          onValueChange={(v) => navigate(`/calculator/${v.toLowerCase()}${window.location.search}`)}
        >
          <TabsList className="flex flex-wrap h-auto">
            {COUNTRY_LIST.map((cfg) => (
              <TabsTrigger key={cfg.code} value={cfg.code} className="gap-1.5">
                <span aria-hidden="true">{cfg.flag}</span> {cfg.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="grid gap-6 md:grid-cols-5">
        {/* ── Inputs ── */}
        <Card className="md:col-span-2 border-0 shadow-md">
          <CardContent className="p-6 space-y-5">
            <div>
              <Label htmlFor="gross">Annual gross salary</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{config.currencySymbol}</span>
                <Input
                  id="gross"
                  inputMode="numeric"
                  value={grossInput}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '');
                    setGrossInput(cleaned);
                    const n = Number(cleaned);
                    if (Number.isFinite(n) && n >= 0) setGross(n);
                  }}
                  className="pl-7"
                  aria-label="Annual gross salary"
                />
              </div>
            </div>

            {/* Sub-region (US state, etc.) */}
            {config.subRegions && config.subRegions.length > 0 && (
              <div>
                <Label htmlFor="sub-region">{config.subRegionLabel ?? 'Region'}</Label>
                <Select value={subRegion ?? ''} onValueChange={setSubRegion}>
                  <SelectTrigger id="sub-region" className="mt-1.5">
                    <SelectValue placeholder={`Select ${(config.subRegionLabel ?? 'region').toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {config.subRegions.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filing status */}
            {config.filingStatuses && config.filingStatuses.length > 0 && (
              <div>
                <Label>{config.filingStatusLabel ?? 'Filing status'}</Label>
                <Tabs value={filingStatus ?? ''} onValueChange={setFilingStatus} className="mt-1.5">
                  <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${config.filingStatuses.length}, minmax(0, 1fr))` }}>
                    {config.filingStatuses.map((f) => (
                      <TabsTrigger key={f.code} value={f.code} className="text-xs">
                        {f.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="pension-toggle" className="cursor-pointer">
                  {country === 'US' ? 'Pre-tax 401(k)' : 'Workplace pension'}
                </Label>
                <Switch id="pension-toggle" checked={hasPension} onCheckedChange={setHasPension} />
              </div>
              {hasPension && (
                <div>
                  <Label htmlFor="pension-pct" className="text-xs text-muted-foreground">Your contribution (% of gross)</Label>
                  <Input
                    id="pension-pct"
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={pensionPercent}
                    onChange={(e) => setPensionPercent(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>

            {country === 'UK' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sl-toggle" className="cursor-pointer">Student loan</Label>
                  <Switch id="sl-toggle" checked={hasStudentLoan} onCheckedChange={setHasStudentLoan} />
                </div>
                {hasStudentLoan && (
                  <Tabs value={studentLoanPlan} onValueChange={(v) => setStudentLoanPlan(v as StudentLoanPlan)}>
                    <TabsList className="grid grid-cols-5 h-auto">
                      <TabsTrigger value="plan1" className="text-xs">Plan 1</TabsTrigger>
                      <TabsTrigger value="plan2" className="text-xs">Plan 2</TabsTrigger>
                      <TabsTrigger value="plan4" className="text-xs">Plan 4</TabsTrigger>
                      <TabsTrigger value="plan5" className="text-xs">Plan 5</TabsTrigger>
                      <TabsTrigger value="postgrad" className="text-xs">PG</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Result ── */}
        <Card className="md:col-span-3 border-0 shadow-md bg-gradient-to-br from-primary/5 via-card to-accent/5">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your monthly take-home</p>
                <p className="mt-1 text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
                  {fmt(breakdown.netPay)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {fmtAnnual(breakdown.netPay)} per year ·{' '}
                  <TooltipProvider><Tooltip>
                    <TooltipTrigger className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2">
                      {effectiveTaxRate.toFixed(1)}% effective rate <Info className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{config.taxAssumptionsBlurb}</TooltipContent>
                  </Tooltip></TooltipProvider>
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={onShare}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>

            <div className="mt-6 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross monthly</span>
                <span className="font-medium text-foreground">{fmt(breakdown.grossMonthly)}</span>
              </div>
              {breakdown.incomeTax > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{config.deductionLines.find((l) => l.expectedKey === 'incomeTax')?.label ?? 'Income tax'}</span>
                  <span className="text-destructive">−{fmt(breakdown.incomeTax)}</span>
                </div>
              )}
              {(breakdown.stateTax ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">State income tax</span>
                  <span className="text-destructive">−{fmt(breakdown.stateTax ?? 0)}</span>
                </div>
              )}
              {breakdown.nationalInsurance > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{config.deductionLines.find((l) => l.expectedKey === 'nationalInsurance')?.label ?? 'Social contributions'}</span>
                  <span className="text-destructive">−{fmt(breakdown.nationalInsurance)}</span>
                </div>
              )}
              {breakdown.usc > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">USC</span>
                  <span className="text-destructive">−{fmt(breakdown.usc)}</span>
                </div>
              )}
              {breakdown.solidarity > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solidarity</span>
                  <span className="text-destructive">−{fmt(breakdown.solidarity)}</span>
                </div>
              )}
              {breakdown.pension > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{country === 'US' ? '401(k)' : 'Pension'}</span>
                  <span className="text-destructive">−{fmt(breakdown.pension)}</span>
                </div>
              )}
              {breakdown.studentLoan > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student loan</span>
                  <span className="text-destructive">−{fmt(breakdown.studentLoan)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2.5 mt-2.5 font-semibold">
                <span className="text-foreground">Net monthly</span>
                <span className="text-success">{fmt(breakdown.netPay)}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Estimate</Badge>
              <p className="text-xs text-muted-foreground">
                Based on 2024 rates. Single, no children. Your actual deductions may differ.
              </p>
            </div>

            {!compact && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/sign-up" className="flex-1 min-w-[200px]">
                  <Button className="w-full gap-2">
                    Track my real payslips <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to={`/guides/${country.toLowerCase()}-payslip-guide`} className="flex-1 min-w-[200px]">
                  <Button variant="outline" className="w-full">
                    Read the {config.name} payslip guide
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!compact && (
        <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">
          {config.taxAssumptionsBlurb} PayCheck provides guidance and issue spotting, not formal tax advice.
        </p>
      )}
    </div>
  );
};

export default NetPayCalculator;
