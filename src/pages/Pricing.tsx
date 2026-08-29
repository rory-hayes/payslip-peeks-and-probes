import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CheckCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { type Subscription, useSubscription } from '@/hooks/use-subscription';
import { useProfile } from '@/hooks/use-profile';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { analytics } from '@/lib/analytics';
import { isPaymentsClientConfigured } from '@/lib/stripe';
import { acceptsRealPayslips } from '@/lib/public-legal-details';
import { applySeo } from '@/lib/seo';
import { marketingSeoFor } from '@/lib/marketing-seo-data';
import { BrandLockup } from '@/components/BrandLockup';
import { checkoutPathForPrice, signUpPathForCheckout, type CheckoutPriceId } from '@/lib/checkout-price';
import {
  CUSTOMER_PRICING,
  getPriceBillingInterval,
  getPriceCurrency,
  type PriceBillingInterval,
  type PriceCurrency,
} from '@/lib/customer-pricing';

const freeFeatures = [
  '2 automatic payslip checks total',
  'Enough to unlock your first real comparison',
  'Review, track, and compare confirmed payslips',
  '2 payroll-message drafts per calendar month',
  'UK or Ireland relief scan and tax-year checklist',
  'PDF export of your payslip history',
  'Contact us by email',
];

const plusFeatures = [
  'Up to 6 automatic payslip checks per calendar month',
  'Up to 12 payroll-message drafts per calendar month',
  'All Free plan features',
];

type SubscriptionActionState = 'checking' | 'error' | 'ready' | 'unavailable';
type SubscriptionPlanCard = 'free' | 'plus' | 'lifetime';

interface AuthenticatedPlanActionProps {
  card: SubscriptionPlanCard;
  state: SubscriptionActionState;
  subscription: Subscription;
  planLabel: string;
  priceId?: CheckoutPriceId;
  onCheckout: (priceId: CheckoutPriceId) => void;
}

function AuthenticatedPlanAction({
  card,
  state,
  subscription,
  planLabel,
  priceId,
  onCheckout,
}: AuthenticatedPlanActionProps) {
  const isPaidCard = card !== 'free';
  const isLifetimeCard = card === 'lifetime';
  const className = isLifetimeCard
    ? 'w-full mt-8 border-amber-300 text-amber-700 hover:bg-amber-50'
    : 'w-full mt-8';
  const variant = isPaidCard && !isLifetimeCard ? 'default' : 'outline';

  if (state === 'checking') {
    return (
      <Button variant={variant} className={className} disabled aria-describedby="subscription-checking">
        Checking your plan…
      </Button>
    );
  }

  if (state === 'error') {
    return (
      <Button variant={variant} className={className} disabled aria-describedby="subscription-error">
        Plan status unavailable
      </Button>
    );
  }

  if (state === 'unavailable') {
    return (
      <Button variant={variant} className={className} disabled aria-describedby="checkout-availability">
        {isPaidCard ? 'Checkout unavailable' : 'Plan unavailable'}
      </Button>
    );
  }

  if (!isPaidCard) {
    return (
      <Button variant="outline" className={className} disabled>
        {subscription.isPremium ? 'Downgrade' : 'Current plan'}
      </Button>
    );
  }

  if (subscription.isPremium) {
    return (
      <Button variant={variant} className={className} disabled>
        Current plan ({planLabel})
      </Button>
    );
  }

  if (!priceId) {
    return (
      <Button variant={variant} className={className} disabled>
        Checkout unavailable
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => onCheckout(priceId)}
    >
      {card === 'plus' ? 'Upgrade to Plus' : 'Choose Lifetime'}
    </Button>
  );
}

const Pricing = () => {
  const { user } = useAuth();
  const {
    data: profile,
    isError: isProfileError,
    isFetching: isProfileFetching,
    isSuccess: isProfileSettled,
    refetch: refetchProfile,
  } = useProfile();
  const {
    subscription,
    isError: isSubscriptionError,
    isFetching: isSubscriptionFetching,
    isSuccess: isSubscriptionSettled,
    refetch: refetchSubscription,
  } = useSubscription();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isLoggedIn = !!user;
  const currency = isLoggedIn
    ? profile?.currency === 'GBP' ? 'GBP' : 'EUR'
    : getPriceCurrency(searchParams.get('currency')) ?? 'EUR';
  const billing = getPriceBillingInterval(searchParams.get('billing')) ?? 'yearly';
  const pricing = CUSTOMER_PRICING[currency];
  const plusPrice = pricing.plus[billing];

  useEffect(() => {
    applySeo(marketingSeoFor('/pricing'));
  }, []);

  if (isLoggedIn && !isProfileSettled) {
    return (
      <div className="min-h-screen bg-card">
        <PaymentTestModeBanner />
        <main className="container flex min-h-[70vh] max-w-2xl items-center justify-center py-16">
          <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <Link to="/dashboard" className="inline-flex">
              <BrandLockup size="sm" />
            </Link>
            {isProfileError ? (
              <div className="mt-6" role="alert">
                <h1 className="text-xl font-semibold text-foreground">We couldn’t confirm your billing country</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  We have not changed your plan or started a checkout. Try again before choosing a paid plan.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void refetchProfile()}
                    disabled={isProfileFetching}
                  >
                    {isProfileFetching ? 'Retrying…' : 'Try again'}
                  </Button>
                  <Button asChild className="min-h-11">
                    <Link to="/settings">Review country in Settings</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6" role="status">
                <h1 className="text-xl font-semibold text-foreground">Confirming your billing country…</h1>
                <p className="mt-3 text-sm text-muted-foreground">We’ll show the exact price and currency before checkout.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  const setCurrency = (nextCurrency: PriceCurrency) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextCurrency === 'EUR') next.delete('currency');
      else next.set('currency', nextCurrency);
      return next;
    }, { replace: true });
  };

  const setBilling = (nextBilling: PriceBillingInterval) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextBilling === 'yearly') next.delete('billing');
      else next.set('billing', nextBilling);
      return next;
    }, { replace: true });
  };

  const paymentsConfigured = isPaymentsClientConfigured();
  const checkoutAvailable = paymentsConfigured && acceptsRealPayslips;
  const subscriptionActionState: SubscriptionActionState = !isLoggedIn
    ? checkoutAvailable ? 'ready' : 'unavailable'
    : !checkoutAvailable
      ? 'unavailable'
      : isSubscriptionError
        ? 'error'
        : isSubscriptionSettled
          ? 'ready'
          : 'checking';

  const handleCheckout = (priceId: CheckoutPriceId) => {
    if (!checkoutAvailable || (isLoggedIn && subscriptionActionState !== 'ready')) return;
    analytics.track('pricing_cta_clicked');
    if (!isLoggedIn) {
      navigate(signUpPathForCheckout(priceId));
      return;
    }
    if (subscription.needsBillingReview) {
      navigate('/settings');
      return;
    }
    // Prevent duplicate purchase
    if (subscription.isPremium) return;
    navigate(checkoutPathForPrice(priceId));
  };

  const handleRetrySubscription = async () => {
    try {
      await refetchSubscription();
    } catch {
      // React Query retains the error state for the visible retry message.
    }
  };

  const planLabel = subscription.plan === 'lifetime' ? 'Lifetime' : subscription.plan === 'plus' ? 'Plus' : 'Free';

  return (
    <div className="min-h-screen bg-card">
      <PaymentTestModeBanner />
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between">
          <Link to={isLoggedIn ? '/dashboard' : '/'} className="flex items-center gap-2">
            <BrandLockup size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden min-h-11 sm:inline-flex">
                  <Link to="/sign-in">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="min-h-11">
                  <Link to="/sign-up">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="container py-16 md:py-24">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">Simple, transparent pricing</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Use Free to check two payslips and see your first comparison. Choose a paid plan for continued payday checks and payroll-message drafts.
            </p>

            {/* Public visitors can compare markets; signed-in customers get one account currency. */}
            {isLoggedIn ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  New purchases are shown in {pricing.currency} ({pricing.symbol}) for your {pricing.countryLabel} account.
                </p>
                <p className="text-xs text-muted-foreground">
                  Need to correct your country? <Link to="/settings" className="font-medium text-primary hover:underline">Update it in Settings</Link> before checkout.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Choose billing currency">
                  <button
                    type="button"
                    onClick={() => setCurrency('EUR')}
                    aria-pressed={currency === 'EUR'}
                    aria-label="Show prices in euro"
                    className={`min-h-11 px-4 rounded-md text-sm font-medium transition-colors ${
                      currency === 'EUR' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Ireland · EUR
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('GBP')}
                    aria-pressed={currency === 'GBP'}
                    aria-label="Show prices in pounds sterling"
                    className={`min-h-11 px-4 rounded-md text-sm font-medium transition-colors ${
                      currency === 'GBP' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    United Kingdom · GBP
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose the currency for your plan. It does not change the country you select when reviewing a payslip.
                </p>
              </div>
            )}
            <p className="sr-only" aria-live="polite">
              Prices are shown for {pricing.countryLabel} in {pricing.currency}.
            </p>
          </div>

          {/* Plans */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Free */}
            <Card className="border shadow-sm">
              <CardContent className="p-8 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-foreground">Free</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{pricing.symbol}0</span>
                  <span className="text-muted-foreground"> forever</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Prove the value with your first payslip and first comparison.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
                  {freeFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                {isLoggedIn ? (
                  <AuthenticatedPlanAction
                    card="free"
                    state={subscriptionActionState}
                    subscription={subscription}
                    planLabel={planLabel}
                    onCheckout={handleCheckout}
                  />
                ) : (
                  <Button asChild variant="outline" className="mt-8 w-full">
                    <Link to="/sign-up">Get started free</Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Plus */}
            <Card className="border-2 border-primary shadow-lg">
              <CardContent className="p-8 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-foreground">Plus</h3>

                {/* Billing toggle */}
                <div className="mt-4">
                  {billing === 'yearly' ? (
                    <>
                      <span className="text-4xl font-bold text-foreground">{pricing.symbol}{pricing.plus.yearly.display}</span>
                      <span className="text-muted-foreground">/year</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        That's just {pricing.symbol}{pricing.yearlyPerMonth}/month
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-foreground">{pricing.symbol}{pricing.plus.monthly.display}</span>
                      <span className="text-muted-foreground">/month</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-xs font-medium ${billing === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}`}>Yearly</span>
                  <Switch
                    checked={billing === 'monthly'}
                    onCheckedChange={(checked) => setBilling(checked ? 'monthly' : 'yearly')}
                    aria-label={`Use ${billing === 'monthly' ? 'yearly' : 'monthly'} Plus billing`}
                  />
                  <span className={`text-xs font-medium ${billing === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  More automatic checks and payroll-message drafts when you need them.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
                  {plusFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-xs leading-5 text-muted-foreground">
                  {billing === 'yearly'
                    ? `Billed ${pricing.symbol}${pricing.plus.yearly.display} today, then every year until you cancel.`
                    : `Billed ${pricing.symbol}${pricing.plus.monthly.display} today, then every month until you cancel.`}{' '}
                  <Link to="/terms" className="font-medium text-foreground underline underline-offset-2 hover:text-primary">
                    Billing terms
                  </Link>
                </p>
                {isLoggedIn ? (
                  <AuthenticatedPlanAction
                    card="plus"
                    state={subscriptionActionState}
                    subscription={subscription}
                    planLabel={planLabel}
                    priceId={plusPrice.checkoutPriceId}
                    onCheckout={handleCheckout}
                  />
                ) : (
                  <Button
                    className="w-full mt-8"
                    disabled={!checkoutAvailable}
                    aria-describedby={checkoutAvailable ? undefined : 'checkout-availability'}
                    onClick={() => handleCheckout(plusPrice.checkoutPriceId)}
                  >
                    {checkoutAvailable ? 'Choose Plus' : 'Checkout unavailable'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Founder Lifetime */}
            <Card className="border shadow-sm">
              <CardContent className="p-8 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-foreground">Lifetime</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{pricing.symbol}{pricing.lifetime.display}</span>
                  <span className="text-muted-foreground"> once</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  One payment for the Lifetime plan. It does not renew.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
                  {plusFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                {isLoggedIn ? (
                  <AuthenticatedPlanAction
                    card="lifetime"
                    state={subscriptionActionState}
                    subscription={subscription}
                    planLabel={planLabel}
                    priceId={pricing.lifetime.checkoutPriceId}
                    onCheckout={handleCheckout}
                  />
                ) : (
                  <Button
                    variant="outline"
                    className="w-full mt-8 border-amber-300 text-amber-700 hover:bg-amber-50"
                    disabled={!checkoutAvailable}
                    aria-describedby={checkoutAvailable ? undefined : 'checkout-availability'}
                    onClick={() => handleCheckout(pricing.lifetime.checkoutPriceId)}
                  >
                    {checkoutAvailable ? 'Choose Lifetime' : 'Checkout unavailable'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {!checkoutAvailable && (
            <p id="checkout-availability" role="status" className="text-center text-sm text-muted-foreground">
              {!acceptsRealPayslips
                ? 'Checkout and real payslip uploads remain closed until the service operator and public legal details are complete.'
                : isLoggedIn
                  ? 'Online checkout is unavailable right now, so we cannot confirm your billing status in this browser.'
                  : 'Online checkout is unavailable right now. You can still create a Free account.'}
            </p>
          )}

          {isLoggedIn && subscriptionActionState === 'checking' && (
            <p id="subscription-checking" role="status" className="text-center text-sm text-muted-foreground">
              Checking your plan before we show account actions…
            </p>
          )}

          {isLoggedIn && subscriptionActionState === 'error' && (
            <div
              id="subscription-error"
              role="alert"
              className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-foreground"
            >
              <p>We couldn’t confirm your plan. We have not changed your plan or started a checkout.</p>
              <Button variant="outline" className="min-h-11" onClick={() => void handleRetrySubscription()} disabled={isSubscriptionFetching}>
                {isSubscriptionFetching ? 'Retrying…' : 'Try again'}
              </Button>
            </div>
          )}

          {/* Comparison table */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div
                className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                role="region"
                aria-label="Plan feature comparison. Scroll horizontally to see every plan."
                tabIndex={0}
              >
                <table className="w-full min-w-[42rem] border-collapse text-sm">
                  <caption className="sr-only">Compare the Free, Plus, and Lifetime plans</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-border bg-muted/50 p-4 text-left font-medium text-muted-foreground">Feature</th>
                      <th scope="col" className="border-b border-border bg-muted/50 p-4 text-center font-medium text-muted-foreground">Free</th>
                      <th scope="col" className="border-b border-border bg-muted/50 p-4 text-center font-medium text-primary">Plus</th>
                      <th scope="col" className="border-b border-border bg-muted/50 p-4 text-center font-medium text-amber-600">Lifetime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: 'Automatic payslip checks', free: '2 total', plus: '6 / calendar month', lifetime: '6 / calendar month' },
                      { feature: 'Payslip review', free: 'Included', plus: 'Included', lifetime: 'Included' },
                      { feature: 'Payslip comparison & trends', free: 'Included', plus: 'Included', lifetime: 'Included' },
                      { feature: 'Payroll-message drafts', free: '2 / calendar month', plus: '12 / calendar month', lifetime: '12 / calendar month' },
                      { feature: 'Tax-year relief scan & official checklist', free: 'Included', plus: 'Included', lifetime: 'Included' },
                      { feature: 'PDF export', free: 'Included', plus: 'Included', lifetime: 'Included' },
                      { feature: 'Contact', free: 'Email', plus: 'Email', lifetime: 'Email' },
                      { feature: 'Billing', free: 'No charge', plus: 'Monthly or yearly', lifetime: 'One payment' },
                    ].map((row) => (
                      <tr key={row.feature}>
                        <th scope="row" className="border-b border-border p-4 text-left font-normal text-muted-foreground">{row.feature}</th>
                        <td className="border-b border-border p-4 text-center text-foreground">{row.free}</td>
                        <td className="border-b border-border p-4 text-center font-medium text-foreground">{row.plus}</td>
                        <td className="border-b border-border p-4 text-center font-medium text-foreground">{row.lifetime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            The total for your selected plan is shown before you pay. Recurring plans can be managed from your account.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
