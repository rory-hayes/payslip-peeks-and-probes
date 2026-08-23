import { useSearchParams, Link, Navigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { BrandLockup } from "@/components/BrandLockup";
import { getCheckoutPriceId } from '@/lib/checkout-price';

export default function Checkout() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const priceId = getCheckoutPriceId(searchParams.get("price"));

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
        <StripeEmbeddedCheckout priceId={priceId} />
      </main>
    </div>
  );
}
