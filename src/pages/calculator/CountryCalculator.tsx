import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import TaxEstimateUnavailable from '@/components/TaxEstimateUnavailable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LAUNCH_COUNTRY_LIST,
  getCountryConfig,
  type LaunchCountryCode,
} from '@/lib/countries';
import { getTaxEstimateAvailability } from '@/lib/tax-estimate-availability';
import { applySeo } from '@/lib/seo';
import { ArrowRight, CheckCircle2, ChevronRight, Eye, Upload } from 'lucide-react';

const SLUG_MAP: Record<string, LaunchCountryCode> = {
  uk: 'UK',
  ireland: 'Ireland',
};

const CountryCalculator = () => {
  const { country: slug } = useParams<{ country: string }>();
  const code: LaunchCountryCode | null = slug ? SLUG_MAP[slug.toLowerCase()] ?? null : null;
  const config = getCountryConfig(code);
  const estimateAvailability = getTaxEstimateAvailability(code);

  useEffect(() => {
    if (!code) return;
    applySeo({
      title: `${config.name} take-home calculator update | Payslip Insights`,
      description: `We are verifying current ${config.name} payroll rates before publishing new take-home estimates. Review and track your confirmed payslip with Payslip Insights in the meantime.`,
      canonicalPath: null,
      noIndex: true,
    });
  }, [code, config]);

  if (!code) return <Navigate to="/calculator" replace />;

  return (
    <div className="min-h-screen bg-card">
      <MarketingNav active="calculator" />

      <div className="container pt-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link to="/calculator" className="hover:text-foreground">Calculator</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">{config.name}</span>
        </nav>
      </div>

      <section className="py-10 md:py-14">
        <div className="container max-w-3xl text-center">
          <div className="text-4xl mb-3" aria-hidden="true">{config.flag}</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
            {config.name} take-home calculator update
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            We are verifying the current {config.name} payroll rules before we show a new take-home estimate.
          </p>
        </div>
      </section>

      <main className="container max-w-3xl pb-16 space-y-8">
        <TaxEstimateUnavailable message={estimateAvailability.message} />

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-xl font-bold text-foreground">Your real payslip is still the better starting point</h2>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              Upload a confirmed UK or Ireland payslip to keep a private pay history, see changes over time, and prepare a clear payroll question when something looks different.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Upload, title: 'Upload', copy: 'Add a PDF or photo, then confirm every extracted figure.' },
                { icon: Eye, title: 'Review', copy: 'Keep the numbers you have checked against the original payslip.' },
                { icon: CheckCircle2, title: 'Track', copy: 'Compare confirmed pay across payday periods.' },
              ].map((item) => (
                <div key={item.title} className="rounded-lg bg-muted/50 p-4">
                  <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                </div>
              ))}
            </div>
            <Button asChild size="lg" className="mt-6 gap-2">
              <Link to="/sign-up">
                Start tracking free <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <section>
          <h2 className="text-xl font-bold text-foreground">What will return with the update</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            We will bring back the calculator only after the tax table, assumptions, and date coverage are clearly stated and checked for the current period.
          </p>
          <div className="mt-4 grid gap-2 grid-cols-2">
            {LAUNCH_COUNTRY_LIST.filter((countryConfig) => countryConfig.code !== code).map((countryConfig) => (
              <Link
                key={countryConfig.code}
                to={`/calculator/${countryConfig.code.toLowerCase()}`}
                className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-primary/40 hover:text-primary transition-colors"
              >
                <span aria-hidden="true">{countryConfig.flag}</span> {countryConfig.name}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default CountryCalculator;
