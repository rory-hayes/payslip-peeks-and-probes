import { loadStripe, Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";

export type StripeEnvironment = "sandbox" | "live";
export type PaymentsClientConfigurationStatus = "configured" | "unconfigured" | "invalid";

export interface PaymentsClientConfiguration {
  status: PaymentsClientConfigurationStatus;
  environment: StripeEnvironment | null;
}

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN?.trim();

export function resolvePaymentsClientConfiguration(value: string | undefined): PaymentsClientConfiguration {
  const token = value?.trim();
  if (!token) return { status: "unconfigured", environment: null };
  if (token.startsWith("pk_test_") && token.length > "pk_test_".length) {
    return { status: "configured", environment: "sandbox" };
  }
  if (token.startsWith("pk_live_") && token.length > "pk_live_".length) {
    return { status: "configured", environment: "live" };
  }
  return { status: "invalid", environment: null };
}

const paymentsClientConfiguration = resolvePaymentsClientConfiguration(clientToken);

export function getPaymentsClientConfiguration(): PaymentsClientConfiguration {
  return paymentsClientConfiguration;
}

/**
 * The publishable key is intentionally public, but a missing or malformed key
 * must never turn a direct /checkout visit into an uncaught application error.
 */
export function isPaymentsClientConfigured(): boolean {
  return paymentsClientConfiguration.status === "configured";
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken || !isPaymentsClientConfigured()) {
      throw new Error("Online checkout is not configured.");
    }
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export async function getStripePriceId(priceId: string): Promise<string> {
  const environment = getStripeEnvironment();
  if (!environment) {
    throw new Error("Online checkout is not configured.");
  }

  const { data, error } = await supabase.functions.invoke("get-stripe-price", {
    body: { priceId, environment },
  });
  if (error || !data?.stripeId) {
    throw new Error(`Failed to resolve price: ${priceId}`);
  }
  return data.stripeId;
}

export function getStripeEnvironment(): StripeEnvironment | null {
  return paymentsClientConfiguration.environment;
}
