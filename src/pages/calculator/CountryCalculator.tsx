import { useEffect, useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import NetPayCalculator from '@/components/calculator/NetPayCalculator';
import StickySignupBar from '@/components/calculator/StickySignupBar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { COUNTRY_LIST, getCountryConfig, type CountryCode } from '@/lib/countries';
import { applySeo } from '@/lib/seo';
import { calculateExpectedMonthly } from '@/lib/tax-calculator';
import { ArrowRight, ChevronRight, Upload, Eye, AlertTriangle } from 'lucide-react';

const SLUG_MAP: Record<string, CountryCode> = {
  uk: 'UK',
  ireland: 'Ireland',
  germany: 'Germany',
  france: 'France',
  netherlands: 'Netherlands',
  spain: 'Spain',
  italy: 'Italy',
  belgium: 'Belgium',
  portugal: 'Portugal',
};

const CountryCalculator = () => {
  const { country: slug } = useParams<{ country: string }>();
  const [searchParams] = useSearchParams();
  const code: CountryCode | null = slug ? SLUG_MAP[slug.toLowerCase()] ?? null : null;
  // Always call hooks; render <Navigate /> below if invalid.
  const config = getCountryConfig(code);
  const grossParam = Number(searchParams.get('gross'));
  const grossForSeo = Number.isFinite(grossParam) && grossParam > 0 ? grossParam : null;

  const sampleSalaries = useMemo(() => {
    if (!code) return [];
    const seeds = code === 'UK' ? [25000, 35000, 50000, 75000, 100000] : [30000, 45000, 60000, 80000, 100000];
    return seeds.map((s) => ({
      gross: s,
      breakdown: calculateExpectedMonthly(s, code, {}),
    }));
  }, [code]);

  useEffect(() => {
    if (!code) return;
    const titleBase = grossForSeo
      ? `${config.currencySymbol}${grossForSeo.toLocaleString(config.locale)} after tax in ${config.name} — 2024/25`
      : `${config.name} take-home pay calculator — 2024/25`;
    applySeo({
      title: `${titleBase} | PayCheck`,
      description: `Calculate your ${config.name} net (after-tax) pay for 2024/25. Includes ${config.deductionLines
        .map((l) => l.label)
        .join(', ')}. Free, instant, shareable.`,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: `${config.name} take-home pay calculator`,
          applicationCategory: 'FinanceApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: config.currency },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: window.location.origin + '/' },
            { '@type': 'ListItem', position: 2, name: 'Calculator', item: window.location.origin + '/calculator' },
            { '@type': 'ListItem', position: 3, name: `${config.name}`, item: window.location.origin + window.location.pathname },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `How is ${config.name} take-home pay calculated?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `${config.taxAssumptionsBlurb} The calculator subtracts ${config.deductionLines.map((l) => l.label).join(', ')} from your annual gross salary and divides by twelve.`,
              },
            },
            {
              '@type': 'Question',
              name: 'Are these results official?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'No. The calculator is an estimate based on 2024/25 standard rates. Your actual payslip may differ due to regional taxes, marital status, benefits in kind, or one-off adjustments.',
              },
            },
          ],
        },
      ],
    });
  }, [code, config, grossForSeo]);

  if (!code) return <Navigate to="/calculator" replace />;

  return (
    <div className="min-h-screen bg-card">
      <MarketingNav active="calculator" />

      {/* Breadcrumbs */}
      <div className="container pt-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link to="/calculator" className="hover:text-foreground">Calculator</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">{config.name}</span>
        </nav>
      </div>

      {/* Hero + calculator */}
      <section className="py-10 md:py-14">
        <div className="container max-w-5xl">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3" aria-hidden="true">{config.flag}</div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              {config.name} take-home pay calculator
            </h1>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Enter your annual gross salary to see your 2024/25 monthly net pay, with a full deduction breakdown.
            </p>
          </div>
          <NetPayCalculator country={code} lockCountry />
        </div>
      </section>

      <main className="container max-w-3xl pb-16 space-y-12">
        {/* Sample table — great for SEO */}
        <section>
          <h2 className="text-2xl font-bold text-foreground">Take-home pay at common salaries in {config.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Estimated monthly net pay for a single person on standard 2024/25 rates with no pension or student loan.
          </p>
          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-background">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Annual gross</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Monthly net</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Effective rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sampleSalaries.map(({ gross, breakdown }) => (
                  <tr key={gross} className="bg-card">
                    <td className="px-4 py-3 text-foreground">
                      <Link
                        to={`/calculator/${slug}?gross=${gross}`}
                        className="hover:underline"
                      >
                        {config.currencySymbol}{gross.toLocaleString(config.locale)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {config.currencySymbol}
                      {breakdown.netPay.toLocaleString(config.locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {(((breakdown.totalDeductions * 12) / gross) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* What's deducted */}
        <section>
          <h2 className="text-2xl font-bold text-foreground">What's deducted from your {config.name} payslip</h2>
          <ul className="mt-4 space-y-2 text-muted-foreground">
            {config.deductionLines.map((line) => (
              <li key={line.fieldKey} className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">{line.label}</strong></span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">{config.taxAssumptionsBlurb}</p>
        </section>

        {/* CTA: from estimate to real */}
        <Card className="border-0 bg-primary text-primary-foreground">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold">From estimate to your real payslip</h2>
            <p className="mt-2 text-primary-foreground/85">
              The calculator shows what you <em>should</em> be paid. PayCheck reads your real payslip and tells you whether you actually were — and flags anything unusual.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Upload, title: 'Upload your payslip', desc: 'PDF or photo. We extract every figure.' },
                { icon: Eye, title: 'Compare vs expected', desc: 'See gross, tax, social, net side by side.' },
                { icon: AlertTriangle, title: 'Catch anomalies', desc: 'We flag anything that drifted month-to-month.' },
              ].map((item) => (
                <div key={item.title} className="rounded-lg bg-primary-foreground/10 p-4">
                  <item.icon className="h-5 w-5 mb-2" />
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="mt-1 text-xs text-primary-foreground/80">{item.desc}</p>
                </div>
              ))}
            </div>
            <Link to="/sign-up" className="mt-6 inline-block">
              <Button size="lg" variant="secondary" className="gap-2">
                Start tracking free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">Frequently asked questions</h2>
          <Accordion type="single" collapsible>
            <AccordionItem value="how">
              <AccordionTrigger className="text-left">How is {config.name} take-home pay calculated?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {config.taxAssumptionsBlurb} The calculator subtracts {config.deductionLines.map((l) => l.label).join(', ')} from your annual gross salary and divides by twelve to give you the monthly net figure.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="official">
              <AccordionTrigger className="text-left">Are these results official?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                No. This is an estimate using 2024/25 standard rates. Your actual payslip may differ due to regional taxes, marital status, benefits in kind, or one-off adjustments. Always verify with your employer or a qualified accountant before making financial decisions.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="save">
              <AccordionTrigger className="text-left">Can I save my calculation?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You can copy the URL — every input is preserved as a query parameter, so the link will reload exactly the same calculation. To save it permanently and track it against your real payslips,{' '}
                <Link to="/sign-up" className="text-primary hover:underline">create a free account</Link>.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Other countries */}
        <section>
          <h2 className="text-2xl font-bold text-foreground">Other country calculators</h2>
          <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-3">
            {COUNTRY_LIST.filter((c) => c.code !== code).map((c) => (
              <Link
                key={c.code}
                to={`/calculator/${c.code.toLowerCase()}`}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-primary/40 hover:text-primary transition-colors"
              >
                <span aria-hidden="true">{c.flag}</span> {c.name}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <StickySignupBar />
      <MarketingFooter />
    </div>
  );
};

export default CountryCalculator;
