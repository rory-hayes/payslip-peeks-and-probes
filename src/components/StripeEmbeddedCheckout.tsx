import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface StripeEmbeddedCheckoutProps {
  priceId: string;
}

interface CheckoutErrorState {
  code: string | null;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readCheckoutError(error: unknown): Promise<CheckoutErrorState> {
  const fallback = {
    code: null,
    message: error instanceof Error ? error.message : "We couldn't start checkout. Please try again.",
  };
  if (!isRecord(error) || !("context" in error)) return fallback;

  const context = error.context;
  if (!isRecord(context) || typeof context.clone !== "function") return fallback;

  try {
    const response = context as { clone: () => { json: () => Promise<unknown> } };
    const body: unknown = await response.clone().json();
    if (!isRecord(body)) return fallback;

    return {
      code: typeof body.code === "string" ? body.code : null,
      message: typeof body.error === "string" ? body.error : fallback.message,
    };
  } catch {
    return fallback;
  }
}

function CheckoutProblem({ error }: { error: CheckoutErrorState }) {
  const isExistingPlan = error.code === "billing_already_active";
  const isPending = error.code === "checkout_pending";
  const isReview = error.code === "billing_needs_review";

  const heading = isExistingPlan
    ? "You already have access"
    : isPending
      ? "Your payment is being confirmed"
      : isReview
        ? "We need to check your billing record"
        : "Checkout is unavailable";
  const action = isExistingPlan || isReview
    ? { to: "/settings", label: "Go to Settings" }
    : isPending
      ? { to: "/dashboard", label: "Go to Dashboard" }
      : { to: "/pricing", label: "Back to pricing" };

  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-foreground">{heading}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        {error.message}
      </p>
      {isPending && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Don&apos;t submit another payment. Your access will update as soon as Stripe confirms it.
        </p>
      )}
      <Link to={action.to} className="mt-6 inline-block">
        <Button>{action.label}</Button>
      </Link>
    </div>
  );
}

export function StripeEmbeddedCheckout({ priceId }: StripeEmbeddedCheckoutProps) {
  const [checkoutError, setCheckoutError] = useState<CheckoutErrorState | null>(null);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      // The server owns quantity, return URL, billing environment, and the
      // catalogue. The browser may only request a named plan.
      body: { priceId },
    });
    if (error || !data?.clientSecret) {
      const detail = await readCheckoutError(error);
      setCheckoutError(detail);
      throw new Error(detail.message);
    }

    return data.clientSecret;
  }, [priceId]);

  if (checkoutError) return <CheckoutProblem error={checkoutError} />;

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
