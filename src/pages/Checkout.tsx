import { useSearchParams, Link, Navigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { BrandLockup } from "@/components/BrandLockup";
import { getCheckoutPriceId } from '@/lib/checkout-price';
import { checkoutPriceForCurrency } from '@/lib/customer-pricing';
import { useProfile } from '@/hooks/use-profile';

export default function Checkout() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedPriceId = getCheckoutPriceId(searchParams.get("price"));
  const { data: profile, isLoading: profileLoading, isError: profileError } = useProfile();
  const billingCurrency = profile?.currency === 'GBP' ? 'GBP' : 'EUR';
  const priceId = requestedPriceId
    ? checkoutPriceForCurrency(requestedPriceId, billingCurrency)
    : null;

  if (!user) return <Navigate to="/sign-in" replace />;
  if (!priceId) return <Navigate to="/pricing" replace />;

  return (
    <div className="min-h-screen bg-card">
      <PaymentTestModeBanner />
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/pricing" className="flex items-center gap-2">
            <BrandLockup />
          </Link>
          <Button asChild variant="ghost" size="sm" className="min-h-11 gap-1.5">
            <Link to="/pricing">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to pricing
            </Link>
          </Button>
        </div>
      </nav>
      <main className="container max-w-2xl py-12">
        {profileLoading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm" role="status">
            <p className="text-sm text-muted-foreground">Confirming your billing currency…</p>
          </div>
        ) : profileError ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm" role="alert">
            <h1 className="text-xl font-semibold text-foreground">We couldn’t confirm your billing currency</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Please try again before starting payment. You have not been charged.
            </p>
            <Button asChild className="mt-6">
              <Link to="/pricing">Back to pricing</Link>
            </Button>
          </div>
        ) : (
          <StripeEmbeddedCheckout priceId={priceId} />
        )}
      </main>
    </div>
  );
}
