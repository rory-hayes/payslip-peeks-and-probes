import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, TrendingDown, AlertCircle, GitCompare, Flag, Globe, ArrowRight } from 'lucide-react';
import GuideCTA from '@/components/guides/GuideCTA';

const coreGuides = [
  { title: 'How to Check Your Payslip', desc: 'A simple walk-through of every line on your payslip and what to look for each month.', to: '/guides/how-to-check-your-payslip', icon: FileText },
  { title: 'Why Did My Net Pay Go Down?', desc: 'The common reasons your take-home pay drops, and when it’s worth a closer look.', to: '/guides/why-did-my-net-pay-go-down', icon: TrendingDown },
  { title: 'Common Payslip Mistakes', desc: 'The issues we see most often on UK and Ireland payslips, and how to spot them.', to: '/guides/common-payslip-mistakes', icon: AlertCircle },
  { title: 'How to Compare Two Payslips', desc: 'A line-by-line approach to comparing this month with last month, properly.', to: '/guides/compare-two-payslips', icon: GitCompare },
];

const countryGuides = [
  { title: 'UK Payslip Guide', desc: 'Tax codes, NI, pension and the parts of a UK payslip every employee should understand.', to: '/guides/uk-payslip-guide', icon: Flag },
  { title: 'Ireland Payslip Guide', desc: 'PAYE, PRSI and USC explained in plain English for Ireland-based employees.', to: '/guides/ireland-payslip-guide', icon: Globe },
  { title: 'Germany Payslip Guide', desc: 'Lohnsteuer, Sozialversicherung and Soli explained in plain English for Germany-based employees.', to: '/guides/germany-payslip-guide', icon: Globe },
];

const GuidesIndex = () => {
  useEffect(() => {
    document.title = 'Payslip Guides for UK & Ireland Employees | Payslip Insights';
    const meta = document.querySelector('meta[name="description"]') || (() => {
      const m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); return m;
    })();
    meta.setAttribute('content', 'Plain-English guides to help UK and Ireland employees understand payslips, compare month-to-month changes, and spot issues worth checking.');
  }, []);

  return (
    <div className="min-h-screen bg-card">
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <CheckCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">PayCheck</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <Link to="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</Link>
            <Link to="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link to="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/guides" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Guides</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/sign-in"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/sign-up"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative max-w-3xl text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Payslip guides for UK and Ireland employees
          </h1>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            Clear, plain-English guides to help you understand your payslip, compare month-to-month changes, and spot the issues worth checking before they become problems.
          </p>
        </div>
      </section>

      <main className="container max-w-5xl pb-16">
        {/* Core guides */}
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Core guides</h2>
              <p className="text-sm text-muted-foreground mt-1">The fundamentals — useful no matter where you work.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {coreGuides.map((g) => (
              <Link key={g.to} to={g.to} className="block group">
                <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                      <g.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{g.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{g.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Read guide <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Country guides */}
        <section className="mt-14">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Country-specific guides</h2>
            <p className="text-sm text-muted-foreground mt-1">Tailored to the rules and terminology in your country.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {countryGuides.map((g) => (
              <Link key={g.to} to={g.to} className="block group">
                <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent mb-4">
                      <g.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{g.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{g.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Read guide <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <GuideCTA />

        <p className="text-center text-xs text-muted-foreground">
          Payslip Insights provides guidance and issue spotting, not formal tax, payroll, or legal advice.
        </p>
      </main>
    </div>
  );
};

export default GuidesIndex;
