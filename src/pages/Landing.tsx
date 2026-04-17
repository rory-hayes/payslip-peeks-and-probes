import { Link, useNavigate } from 'react-router-dom';
import { useDemo } from '@/contexts/DemoContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Upload,
  Shield,
  TrendingUp,
  AlertTriangle,
  FileCheck,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  Lock,
  Eye,
  BarChart3,
  Zap,
} from 'lucide-react';
import heroImg from '@/assets/hero-illustration.jpg';

const Landing = () => {
  const navigate = useNavigate();
  const { enableDemo } = useDemo();

  const handleTryDemo = () => {
    enableDemo();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-card">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <CheckCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">PayCheck</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/sign-in">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/sign-up">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div className="animate-fade-in">
              <Badge variant="secondary" className="mb-4 rounded-full px-4 py-1.5 text-xs font-medium">
                Built for UK & Ireland employees
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                Upload your payslip.{' '}
                <span className="text-primary">Catch mistakes early.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg text-muted-foreground leading-relaxed">
                PayCheck helps you understand your payslips, track changes month to month, and spot issues before they become problems. No jargon. No guesswork.
              </p>
                <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/sign-up">
                  <Button size="lg" className="gap-2 px-6">
                    Start checking payslips <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="px-6" onClick={handleTryDemo}>
                  Try the demo
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Lock className="h-4 w-4" /> Bank-level security</span>
                <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" /> Your data stays yours</span>
              </div>
            </div>
            <div className="animate-fade-in-delay-1 flex justify-center">
              <img
                src={heroImg}
                alt="PayCheck payslip analysis illustration"
                className="w-full max-w-md rounded-2xl shadow-2xl shadow-primary/10"
                width={1280}
                height={960}
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-background py-20 md:py-28">
        <div className="container">
          <div className="text-center animate-fade-in">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">How PayCheck works</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">Three simple steps to take control of your pay</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              { icon: Upload, title: 'Upload your payslip', desc: 'Drop in a PDF or photo of your payslip. We extract the key figures automatically.', step: '1' },
              { icon: Eye, title: 'See what changed', desc: 'We compare your payslip to previous months and highlight any differences worth reviewing.', step: '2' },
              { icon: MessageSquare, title: 'Raise issues easily', desc: 'If something looks off, we draft a clear message you can send straight to payroll.', step: '3' },
            ].map((item, i) => (
              <Card key={i} className={`relative overflow-hidden border-0 shadow-md animate-fade-in-delay-${i + 1}`}>
                <CardContent className="p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="absolute top-4 right-6 text-6xl font-bold text-muted/50">{item.step}</div>
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="container">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Everything you need to stay on top of your pay</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">Built specifically for employees in the UK and Ireland</p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: FileCheck, title: 'Smart extraction', desc: 'We read your payslip and pull out gross pay, tax, NI/PRSI, USC, pension, and more.' },
              { icon: TrendingUp, title: 'Month-to-month tracking', desc: 'See trends in your net pay, tax, and deductions over time with clear charts.' },
              { icon: AlertTriangle, title: 'Anomaly detection', desc: 'We flag unexpected changes — like a sudden tax jump or a new deduction you didn\'t expect.' },
              { icon: BarChart3, title: 'Side-by-side comparison', desc: 'Compare any two payslips side by side. Every difference is highlighted clearly.' },
              { icon: MessageSquare, title: 'Ready-to-send drafts', desc: 'We generate professional messages you can copy and send to your payroll team.' },
              { icon: Lock, title: 'Privacy first', desc: 'Your payslip data is encrypted and stored securely. Only you can access it.' },
            ].map((feature, i) => (
              <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent mb-4">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Country support */}
      <section className="bg-background py-20">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="border-0 shadow-md">
              <CardContent className="p-8">
                <div className="text-3xl mb-4">🇬🇧</div>
                <h3 className="text-xl font-bold text-foreground">United Kingdom</h3>
                <p className="mt-2 text-sm text-muted-foreground">Tax code checks, National Insurance validation, student loan tracking, pension monitoring, and HMRC-aware analysis.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-8">
                <div className="text-3xl mb-4">🇮🇪</div>
                <h3 className="text-xl font-bold text-foreground">Ireland</h3>
                <p className="mt-2 text-sm text-muted-foreground">Income tax, PRSI, and USC validation. LPT tracking, pension monitoring, and Revenue-aware analysis.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="container">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Simple, transparent pricing</h2>
            <p className="mt-4 text-muted-foreground">Start free. Upgrade when you need more.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
             <Card className="border shadow-sm">
              <CardContent className="p-8">
                <h3 className="font-semibold text-foreground">Free</h3>
                <div className="mt-4"><span className="text-4xl font-bold text-foreground">£0</span><span className="text-muted-foreground">/month</span></div>
                <p className="mt-2 text-sm text-muted-foreground">Great for getting started.</p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {['3 payslip uploads/month', 'Basic anomaly checks', '1 month comparison', '2 issue drafts/month'].map((f, i) => (
                    <li key={i} className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}</li>
                  ))}
                </ul>
                <Link to="/sign-up" className="mt-8 block">
                  <Button variant="outline" className="w-full">Get started free</Button>
                </Link>
              </CardContent>
            </Card>
            <Card className="border-2 border-primary shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Most popular</Badge>
              </div>
              <CardContent className="p-8">
                <h3 className="font-semibold text-foreground">Plus</h3>
                <div className="mt-4"><span className="text-4xl font-bold text-foreground">£17.99</span><span className="text-muted-foreground">/year</span></div>
                <p className="mt-1 text-xs text-muted-foreground">Just £1.50/month</p>
                <p className="mt-2 text-sm text-muted-foreground">Full access. Peace of mind, every pay day.</p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {['Unlimited payslip uploads', 'Full anomaly detection suite', 'Compare any two payslips', 'Unlimited issue drafts', 'Historical trends & insights', 'Priority support'].map((f, i) => (
                    <li key={i} className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}</li>
                  ))}
                </ul>
                <Link to="/sign-up" className="mt-8 block">
                  <Button className="w-full">Start free trial</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
          <div className="mt-8 text-center">
            <Link to="/pricing" className="text-sm text-primary hover:underline">
              View full pricing comparison →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-background py-20 md:py-28">
        <div className="container max-w-3xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Frequently asked questions</h2>
          </div>
          <Accordion type="single" collapsible className="mt-12">
            {[
              { q: 'Is PayCheck tax advice?', a: 'No. PayCheck is a payslip checking and issue-spotting tool. Our findings are guidance only — not formal tax, legal, or payroll advice. Always confirm with your employer or a professional if you\'re unsure.' },
              { q: 'Is my payslip data secure?', a: 'Absolutely. Your data is encrypted in transit and at rest. We use bank-level security practices. Only you can access your payslips — we never share your data with third parties.' },
              { q: 'Which payslip formats do you support?', a: 'We support PDF payslips and photos/images of payslips. We\'re continually improving our extraction engine to handle more formats.' },
              { q: 'Does PayCheck work for both UK and Ireland?', a: 'Yes. PayCheck supports employees in the UK and Ireland with country-specific checks — including tax, NI/PRSI, USC, student loans, and pension deductions.' },
              { q: 'Can I cancel my subscription anytime?', a: 'Yes. You can cancel your Plus subscription at any time. You\'ll keep access until the end of your current billing period.' },
              { q: 'What if the extraction gets something wrong?', a: 'You can review and edit any extracted values before confirming. We also show confidence scores so you know when to double-check a figure.' },
            ].map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-foreground">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <Card className="bg-primary border-0 overflow-hidden">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold text-primary-foreground md:text-4xl">Ready to check your payslips?</h2>
              <p className="mt-4 text-primary-foreground/80 max-w-lg mx-auto">Join thousands of employees who use PayCheck to stay informed about their pay.</p>
              <Link to="/sign-up" className="mt-8 inline-block">
                <Button size="lg" variant="secondary" className="gap-2 px-8">
                  Get started for free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <CheckCircle className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">PayCheck</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <a href="mailto:support@paycheckinsights.com" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            <p className="text-xs text-muted-foreground">© 2026 PayCheck. Not tax or legal advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
