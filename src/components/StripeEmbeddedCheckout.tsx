import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment, isPaymentsClientConfigured } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { parseEmbeddedCheckoutResponse } from '@/lib/embedded-checkout-response';

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
  const isEnvironmentMismatch = error.code === "billing_environment_mismatch";

  const heading = isExistingPlan
    ? "You already have access"
    : isPending
      ? "Your payment is being confirmed"
      : isReview
        ? "We need to check your billing record"
        : isEnvironmentMismatch
          ? "Checkout needs attention"
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
      <Button asChild className="mt-6">
        <Link to={action.to}>{action.label}</Link>
      </Button>
    </div>
  );
}

export function StripeEmbeddedCheckout({ priceId }: StripeEmbeddedCheckoutProps) {
  const [checkoutError, setCheckoutError] = useState<CheckoutErrorState | null>(null);
  const [stripeReady, setStripeReady] = useState(false);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const browserEnvironment = getStripeEnvironment();
    if (!browserEnvironment) {
      const detail = {
        code: "payments_unconfigured",
        message: "Online checkout is unavailable right now. You have not been charged.",
      };
      setCheckoutError(detail);
      throw new Error(detail.message);
    }

    let data: unknown;
    let error: unknown = null;
    try {
      const response = await supabase.functions.invoke("create-checkout", {
        // The server independently owns the catalogue and Stripe environment.
        // This declared mode is only a fail-closed compatibility handshake: it
        // prevents a stale browser bundle from receiving a session secret for a
        // different Stripe mode.
        body: { environment: browserEnvironment, priceId },
      });
      data = response.data;
      error = response.error;
    } catch {
      const detail = {
        code: "payments_unavailable",
        message: "Online checkout is unavailable right now. You have not been charged.",
      };
      setCheckoutError(detail);
      throw new Error(detail.message);
    }
    if (error) {
      const detail = await readCheckoutError(error);
      setCheckoutError(detail);
      throw new Error(detail.message);
    }

    const checkout = parseEmbeddedCheckoutResponse(data);
    if (!checkout || checkout.priceId !== priceId) {
      const detail = {
        code: "checkout_response_invalid",
        message: "We couldn't verify this checkout session. You have not been charged.",
      };
      setCheckoutError(detail);
      throw new Error(detail.message);
    }

    if (checkout.environment !== browserEnvironment) {
      const detail = {
        code: "billing_environment_mismatch",
        message: "Online checkout is temporarily unavailable while we verify its configuration. You have not been charged.",
      };
      setCheckoutError(detail);
      throw new Error(detail.message);
    }

    return checkout.clientSecret;
  }, [priceId]);

  useEffect(() => {
    if (!isPaymentsClientConfigured()) return;

    let active = true;
    void getStripe()
      .then((stripe) => {
        if (!stripe) throw new Error("Stripe did not load");
        if (active) setStripeReady(true);
      })
      .catch(() => {
        if (!active) return;
        setCheckoutError({
          code: "payments_unavailable",
          message: "Online checkout is unavailable right now. You have not been charged.",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  if (checkoutError) return <CheckoutProblem error={checkoutError} />;

  if (!isPaymentsClientConfigured()) {
    return (
      <CheckoutProblem
        error={{
          code: "payments_unconfigured",
          message: "Online checkout is unavailable right now. You have not been charged.",
        }}
      />
    );
  }

  if (!stripeReady) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm" role="status">
        <p className="text-sm text-muted-foreground">Preparing secure checkout…</p>
      </div>
    );
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
