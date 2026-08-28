import { useEffect } from 'react';
import { Link } from 'react-router';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import TaxEstimateUnavailable from '@/components/TaxEstimateUnavailable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LAUNCH_COUNTRY_LIST } from '@/lib/countries';
import { getTaxEstimateAvailability } from '@/lib/tax-estimate-availability';
import { applySeo } from '@/lib/seo';
import { ArrowRight, Calculator as CalculatorIcon, FileCheck2 } from 'lucide-react';

const CalculatorIndex = () => {
  const ukAvailability = getTaxEstimateAvailability('UK');

  useEffect(() => {
    applySeo({
      title: 'Take-home pay calculator update | Payslip Insights',
      description: 'We are verifying current UK and Ireland payroll rules before publishing new take-home estimates. Review and track your confirmed payslip with Payslip Insights.',
      canonicalPath: null,
      noIndex: true,
    });
  }, []);

  return (
    <div className="min-h-screen bg-card">
      <MarketingNav active="calculator" />

      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative max-w-3xl text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5">
            <CalculatorIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Take-home calculator update in progress
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            We are checking the current UK and Ireland payroll rules before publishing a new estimate.
          </p>
        </div>
      </section>

      <main className="container max-w-3xl pb-20 space-y-8">
        <TaxEstimateUnavailable message={ukAvailability.message} />

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-bold text-foreground">Keep calculations tied to confirmed figures</h2>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Payslip Insights is still ready to help you review a payslip, track your confirmed pay, compare pay periods, and spot changes worth checking with payroll.
                </p>
                <Button asChild size="lg" className="mt-5 gap-2">
                  <Link to="/sign-up">
                    Start tracking free <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <section>
          <h2 className="text-xl font-bold text-foreground">Calculator pages</h2>
          <p className="mt-2 text-sm text-muted-foreground">Each page explains when its updated tax table is ready to use.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {LAUNCH_COUNTRY_LIST.map((countryConfig) => (
              <Link
                key={countryConfig.code}
                to={`/calculator/${countryConfig.code.toLowerCase()}`}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:text-primary"
              >
                <span className="text-2xl" aria-hidden="true">{countryConfig.flag}</span>
                <span className="font-medium">{countryConfig.name}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default CalculatorIndex;
