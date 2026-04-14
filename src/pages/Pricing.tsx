import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CheckCircle, ArrowLeft, Crown, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/use-subscription';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';

type Currency = 'GBP' | 'EUR';
type Billing = 'yearly' | 'monthly';

const priceIds: Record<Currency, { yearly: string; monthly: string; lifetime: string }> = {
  EUR: { yearly: 'plus_yearly', monthly: 'plus_monthly', lifetime: 'lifetime_once' },
  GBP: { yearly: 'plus_yearly_gbp', monthly: 'plus_monthly_gbp', lifetime: 'lifetime_once_gbp' },
};

const prices: Record<Currency, { symbol: string; yearly: string; yearlyPerMonth: string; monthly: string; lifetime: string }> = {
  GBP: { symbol: '£', yearly: '17.99', yearlyPerMonth: '1.50', monthly: '2.99', lifetime: '29.99' },
  EUR: { symbol: '€', yearly: '19.99', yearlyPerMonth: '1.67', monthly: '3.49', lifetime: '34.99' },
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
  'PDF export',
  'Priority support',
];

const Pricing = () => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();

  const [currency, setCurrency] = useState<Currency>('EUR');
  const [billing, setBilling] = useState<Billing>('yearly');
  const p = prices[currency];
  const ids = priceIds[currency];

  const isLoggedIn = !!user;

  const handleCheckout = (priceId: string) => {
    if (!isLoggedIn) {
      navigate('/sign-up');
      return;
    }
    // Prevent duplicate purchase
    if (subscription.isPremium) return;
    navigate(`/checkout?price=${priceId}`);
  };

  const planLabel = subscription.plan === 'lifetime' ? 'Lifetime' : subscription.plan === 'plus' ? 'Plus' : 'Free';

  return (
    <div className="min-h-screen bg-card">
      <PaymentTestModeBanner />
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
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">Simple, transparent pricing</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start free. Upgrade when you need more. No hidden fees, cancel anytime.
            </p>

            {/* Currency toggle */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setCurrency('EUR')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currency === 'EUR' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🇮🇪 EUR
              </button>
              <button
                onClick={() => setCurrency('GBP')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currency === 'GBP' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🇬🇧 GBP
              </button>
            </div>
          </div>

          {/* Plans */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Free */}
            <Card className="border shadow-sm">
              <CardContent className="p-8 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-foreground">Free</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{p.symbol}0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Great for getting started and checking occasional payslips.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
                  {freeFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                {isLoggedIn ? (
                  <Button variant="outline" className="w-full mt-8" disabled>
                    {subscription.isPremium ? 'Downgrade' : 'Current plan'}
                  </Button>
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
                <Badge className="bg-primary text-primary-foreground">Most popular</Badge>
              </div>
              <CardContent className="p-8 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-foreground">Plus</h3>

                {/* Billing toggle */}
                <div className="mt-4">
                  {billing === 'yearly' ? (
                    <>
                      <span className="text-4xl font-bold text-foreground">{p.symbol}{p.yearly}</span>
                      <span className="text-muted-foreground">/year</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        That's just {p.symbol}{p.yearlyPerMonth}/month
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-foreground">{p.symbol}{p.monthly}</span>
                      <span className="text-muted-foreground">/month</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-xs font-medium ${billing === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}`}>Yearly</span>
                  <Switch
                    checked={billing === 'monthly'}
                    onCheckedChange={(checked) => setBilling(checked ? 'monthly' : 'yearly')}
                  />
                  <span className={`text-xs font-medium ${billing === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  Full access to all features. Peace of mind, every pay day.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
                  {plusFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                {isLoggedIn ? (
                  subscription.isPremium ? (
                    <Button variant="outline" className="w-full mt-8" disabled>
                      Current plan ({planLabel})
                    </Button>
                  ) : (
                    <Button className="w-full mt-8" onClick={() => handleCheckout(billing === 'yearly' ? ids.yearly : ids.monthly)}>
                      Upgrade to Plus
                    </Button>
                  )
                ) : (
                  <Button className="w-full mt-8" onClick={() => handleCheckout(billing === 'yearly' ? ids.yearly : ids.monthly)}>
                    Start free trial
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Founder Lifetime */}
            <Card className="border shadow-sm relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                  <Crown className="h-3 w-3 mr-1" /> Founder
                </Badge>
              </div>
              <CardContent className="p-8 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-foreground">Lifetime</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{p.symbol}{p.lifetime}</span>
                  <span className="text-muted-foreground"> once</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  One payment, forever access. Limited availability for early supporters.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
                  {plusFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                {isLoggedIn ? (
                  subscription.isPremium ? (
                    <Button variant="outline" className="w-full mt-8" disabled>
                      Current plan ({planLabel})
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full mt-8 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => handleCheckout(ids.lifetime)}>
                      Get lifetime access
                    </Button>
                  )
                ) : (
                  <Button variant="outline" className="w-full mt-8 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => handleCheckout(ids.lifetime)}>
                    Claim founder deal
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Comparison table */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-4 text-sm">
                <div className="border-b border-border bg-muted/50 p-4 font-medium text-muted-foreground">Feature</div>
                <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-muted-foreground">Free</div>
                <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-primary">Plus</div>
                <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-amber-600">Lifetime</div>
                {[
                  { feature: 'Payslip uploads', free: '3/month', plus: 'Unlimited', lifetime: 'Unlimited' },
                  { feature: 'Anomaly detection', free: 'Basic', plus: 'Full suite', lifetime: 'Full suite' },
                  { feature: 'Payslip comparison', free: '1 month', plus: 'Any two', lifetime: 'Any two' },
                  { feature: 'Issue drafts', free: '2/month', plus: 'Unlimited', lifetime: 'Unlimited' },
                  { feature: 'Historical trends', free: '—', plus: '✓', lifetime: '✓' },
                  { feature: 'PDF export', free: '—', plus: '✓', lifetime: '✓' },
                  { feature: 'Support', free: 'Email', plus: 'Priority', lifetime: 'Priority' },
                  { feature: 'Duration', free: 'Forever', plus: 'Subscription', lifetime: 'Forever' },
                ].map((row, i) => (
                  <div key={i} className="contents">
                    <div className="border-b border-border p-4 text-muted-foreground">{row.feature}</div>
                    <div className="border-b border-border p-4 text-center text-foreground">{row.free}</div>
                    <div className="border-b border-border p-4 text-center text-foreground font-medium">{row.plus}</div>
                    <div className="border-b border-border p-4 text-center text-foreground font-medium">{row.lifetime}</div>
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
