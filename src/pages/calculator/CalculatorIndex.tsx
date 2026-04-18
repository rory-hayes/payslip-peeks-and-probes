import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { Card, CardContent } from '@/components/ui/card';
import { COUNTRY_LIST } from '@/lib/countries';
import { applySeo } from '@/lib/seo';
import { ArrowRight, Calculator as CalculatorIcon } from 'lucide-react';

const CalculatorIndex = () => {
  useEffect(() => {
    applySeo({
      title: 'Take-home pay calculator — UK, Ireland & Europe | PayCheck',
      description:
        'Free 2024/25 net pay calculator for the UK, Ireland, Germany, France, Netherlands, Spain, Italy, Belgium and Portugal. Enter your gross salary and see your monthly take-home in seconds.',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'PayCheck Take-home Calculator',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        description:
          'Free 2024/25 net pay calculator for the UK, Ireland and 7 European countries.',
      },
    });
  }, []);

  return (
    <div className="min-h-screen bg-card">
      <MarketingNav active="calculator" />

      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative max-w-3xl text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5">
            <CalculatorIcon className="h-6 w-6" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Take-home pay calculator
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            Free 2024/25 net pay calculators for nine European countries. Enter your gross salary, see your monthly take-home, and share the result.
          </p>
        </div>
      </section>

      <main className="container max-w-5xl pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COUNTRY_LIST.map((c) => (
            <Link
              key={c.code}
              to={`/calculator/${c.code.toLowerCase()}`}
              className="block group"
            >
              <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
                <CardContent className="p-6">
                  <div className="text-3xl mb-3" aria-hidden="true">{c.flag}</div>
                  <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {c.name} take-home calculator
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Net pay in {c.currency}. Includes {c.deductionLines.map((l) => l.label).slice(0, 2).join(', ')}.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Open calculator <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-14 rounded-xl border border-border bg-background p-6 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">How accurate are these?</strong> Each calculator uses the
            country's 2024/25 income-tax bands and standard employee social-security rates, sourced from
            HMRC, Revenue.ie, the BMF, DGFiP, Belastingdienst, AEAT, Agenzia delle Entrate, ONSS/RSZ and
            the Autoridade Tributária. Results are estimates for a single person with no children — your
            actual deductions may vary based on regional rates, marital status, and benefits in kind.
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default CalculatorIndex;
