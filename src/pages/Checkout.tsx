import { useSearchParams, Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export default function Checkout() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const priceId = searchParams.get("price");

  if (!user) return <Navigate to="/sign-in" replace />;
  if (!priceId) return <Navigate to="/pricing" replace />;

  return (
    <div className="min-h-screen bg-card">
      <PaymentTestModeBanner />
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/pricing" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <CheckCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">PayCheck</span>
          </Link>
          <Link to="/pricing">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to pricing
            </Button>
          </Link>
        </div>
      </nav>
      <div className="container max-w-2xl py-12">
        <StripeEmbeddedCheckout
          priceId={priceId}
          quantity={1}
          customerEmail={user.email}
          userId={user.id}
          returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
        />
      </div>
    </div>
  );
}
