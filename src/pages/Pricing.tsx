import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowLeft, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/use-profile';

type Currency = 'GBP' | 'EUR';

const prices: Record<Currency, { symbol: string; free: string; plus: string }> = {
  GBP: { symbol: '£', free: '0', plus: '4.99' },
  EUR: { symbol: '€', free: '0', plus: '5.99' },
};

const freeFeatures = [
  '3 payslip uploads per month',
  'Basic anomaly checks',
  '1 month comparison',
  '2 issue drafts per month',
  'Email support',
];

const plusFeatures = [
  'Unlimited payslip uploads',
  'Full anomaly detection suite',
  'Compare any two payslips',
  'Unlimited issue drafts',
  'Historical trends & deep insights',
  'Priority support',
];

const Pricing = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  const defaultCurrency: Currency = profile?.country === 'Ireland' ? 'EUR' : 'GBP';
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const p = prices[currency];

  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-card">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between">
          <Link to={isLoggedIn ? '/dashboard' : '/'} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <CheckCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">PayCheck</span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
              </Button>
            ) : (
              <>
                <Link to="/sign-in"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/sign-up"><Button size="sm">Get started</Button></Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="container py-16 md:py-24">
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">Simple, transparent pricing</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start free. Upgrade when you need more. No hidden fees, cancel anytime.
            </p>

            {/* Currency toggle */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setCurrency('GBP')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currency === 'GBP' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🇬🇧 GBP
              </button>
              <button
                onClick={() => setCurrency('EUR')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currency === 'EUR' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🇮🇪 EUR
              </button>
            </div>
          </div>

          {/* Plans */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Free */}
            <Card className="border shadow-sm">
              <CardContent className="p-8">
                <h3 className="text-lg font-semibold text-foreground">Free</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{p.symbol}0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Great for getting started and checking occasional payslips.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {freeFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                {isLoggedIn ? (
                  <Button variant="outline" className="w-full mt-8" disabled>Current plan</Button>
                ) : (
                  <Link to="/sign-up" className="mt-8 block">
                    <Button variant="outline" className="w-full">Get started free</Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Plus */}
            <Card className="border-2 border-primary shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Recommended</Badge>
              </div>
              <CardContent className="p-8">
                <h3 className="text-lg font-semibold text-foreground">Plus</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{p.symbol}{p.plus}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Full access to all features. Peace of mind, every pay day.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {plusFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                {isLoggedIn ? (
                  <Button className="w-full mt-8">Upgrade to Plus</Button>
                ) : (
                  <Link to="/sign-up" className="mt-8 block">
                    <Button className="w-full">Start free trial</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Comparison table */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-3 text-sm">
                <div className="border-b border-border bg-muted/50 p-4 font-medium text-muted-foreground">Feature</div>
                <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-muted-foreground">Free</div>
                <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-primary">Plus</div>
                {[
                  { feature: 'Payslip uploads', free: '3/month', plus: 'Unlimited' },
                  { feature: 'Anomaly detection', free: 'Basic', plus: 'Full suite' },
                  { feature: 'Payslip comparison', free: '1 month', plus: 'Any two payslips' },
                  { feature: 'Issue drafts', free: '2/month', plus: 'Unlimited' },
                  { feature: 'Historical trends', free: '—', plus: '✓' },
                  { feature: 'PDF export', free: '—', plus: '✓' },
                  { feature: 'Support', free: 'Email', plus: 'Priority' },
                ].map((row, i) => (
                  <div key={i} className="contents">
                    <div className="border-b border-border p-4 text-muted-foreground">{row.feature}</div>
                    <div className="border-b border-border p-4 text-center text-foreground">{row.free}</div>
                    <div className="border-b border-border p-4 text-center text-foreground font-medium">{row.plus}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            Cancel anytime. No lock-in. All prices include VAT where applicable.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
