// Release deployment sync: keep this reviewed function aligned with the repository revision.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  checkoutIntentIdempotencyKey,
  createStripeClient,
  getCheckoutIntentId,
  getCheckoutReturnUrl,
  getStripeEnvironment,
  matchesCatalogStripePrice,
  type StripeEnv,
} from "../_shared/stripe.ts";
import { validateCheckoutRequest } from "../_shared/checkout-request.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

type CheckoutIntentState =
  | "creating"
  | "open"
  | "awaiting_payment"
  | "succeeded"
  | "expired"
  | "failed"
  | "requires_review"
  | "account_deletion_pending";

interface CheckoutIntent {
  id: string;
  user_id: string;
  environment: StripeEnv;
  price_lookup_key: string;
  checkout_mode: "payment" | "subscription";
  stripe_price_id: string;
  customer_email: string | null;
  stripe_checkout_session_id: string | null;
  state: CheckoutIntentState;
  expires_at: string;
}

type ExistingSessionResult =
  | { kind: "resume"; clientSecret: string }
  | { kind: "account_deletion_pending" }
  | { kind: "pending" }
  | { kind: "review" }
  | { kind: "expired" };

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCheckoutIntent(value: unknown): value is CheckoutIntent {
  if (!isRecord(value)) return false;

  return typeof value.id === "string"
    && typeof value.user_id === "string"
    && (value.environment === "sandbox" || value.environment === "live")
    && typeof value.price_lookup_key === "string"
    && (value.checkout_mode === "payment" || value.checkout_mode === "subscription")
    && typeof value.stripe_price_id === "string"
    && (typeof value.customer_email === "string" || value.customer_email === null)
    && (typeof value.stripe_checkout_session_id === "string" || value.stripe_checkout_session_id === null)
    && typeof value.state === "string"
    && typeof value.expires_at === "string";
}

function isBlockingSubscription(status: string | null, currentPeriodEnd: string | null) {
  if (status && BLOCKING_SUBSCRIPTION_STATUSES.has(status)) return true;
  if (status !== "canceled" || !currentPeriodEnd) return false;

  const periodEnd = Date.parse(currentPeriodEnd);
  return Number.isFinite(periodEnd) && periodEnd > Date.now();
}

async function hasBlockingBillingState(userId: string, environment: StripeEnv): Promise<boolean> {
  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .eq("environment", environment);

  if (subscriptionsError) throw new Error("Could not load existing billing state");
  if ((subscriptions ?? []).some((subscription) => (
    isBlockingSubscription(subscription.status, subscription.current_period_end)
  ))) {
    return true;
  }

  // The browser still recognises this legacy table as premium access. Treat it
  // as a server-side billing blocker until it is fully migrated; otherwise a
  // paid legacy user could be charged a second time.
  const { data: legacy, error: legacyError } = await supabase
    .from("billing_subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (legacyError) throw new Error("Could not load legacy billing state");
  return legacy?.plan === "plus" && (
    legacy.status === "active" || legacy.status === "past_due"
  );
}

async function acquireCheckoutIntent(
  userId: string,
  environment: StripeEnv,
  priceLookupKey: string,
  checkoutMode: "payment" | "subscription",
  stripePriceId: string,
  customerEmail: string | null,
): Promise<CheckoutIntent> {
  const { data, error } = await supabase.rpc("acquire_secure_checkout_intent", {
    p_user_id: userId,
    p_environment: environment,
    p_price_lookup_key: priceLookupKey,
    p_checkout_mode: checkoutMode,
    p_stripe_price_id: stripePriceId,
    p_customer_email: customerEmail,
  });

  if (error) throw new Error("Could not reserve checkout");
  const intent = Array.isArray(data) ? data[0] : data;
  if (!isCheckoutIntent(intent)) throw new Error("Checkout reservation returned an invalid record");
  return intent;
}

async function transitionIntent(
  intent: CheckoutIntent,
  state: "open" | "awaiting_payment" | "expired" | "requires_review",
  allowedStates: CheckoutIntentState[],
) {
  const { error } = await supabase
    .from("checkout_intents")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", intent.id)
    .eq("user_id", intent.user_id)
    .eq("environment", intent.environment)
    .in("state", allowedStates);

  if (error) throw new Error("Could not update checkout state");
}

async function bindSecureStripeSession(
  intent: CheckoutIntent,
  sessionId: string,
  expiresAt: number | null,
) {
  const expiresAtIso = expiresAt
    ? new Date(expiresAt * 1000).toISOString()
    : intent.expires_at;
  const { data, error } = await supabase.rpc("bind_secure_stripe_checkout_session", {
    p_intent_id: intent.id,
    p_user_id: intent.user_id,
    p_environment: intent.environment,
    p_price_lookup_key: intent.price_lookup_key,
    p_checkout_mode: intent.checkout_mode,
    p_session_id: sessionId,
    p_expires_at: expiresAtIso,
  });

  if (error || typeof data !== "string") {
    throw new Error("Could not safely bind Stripe Checkout Session");
  }
  if (
    data !== "bound"
    && data !== "account_deletion_pending"
    && data !== "requires_review"
    && data !== "not_found"
  ) {
    throw new Error("Stripe Checkout binding returned an unexpected result");
  }
  return data;
}

function matchesCheckoutIntent(
  session: {
    client_reference_id: string | null;
    metadata: Record<string, unknown> | null;
    mode: string | null;
  },
  intent: CheckoutIntent,
  userId: string,
) {
  return session.client_reference_id === userId
    && session.metadata?.userId === userId
    && getCheckoutIntentId(session.metadata) === intent.id
    && session.metadata?.priceLookupKey === intent.price_lookup_key
    && session.mode === intent.checkout_mode;
}

async function resolveExistingStripeSession(
  intent: CheckoutIntent,
  userId: string,
  stripe: ReturnType<typeof createStripeClient>,
): Promise<ExistingSessionResult | null> {
  if (!intent.stripe_checkout_session_id) return null;

  const session = await stripe.checkout.sessions.retrieve(intent.stripe_checkout_session_id);
  if (!matchesCheckoutIntent(session, intent, userId)) {
    await transitionIntent(intent, "requires_review", ["creating", "open", "awaiting_payment"]);
    return { kind: "review" };
  }

  if (session.status === "open") {
    if (!session.client_secret) throw new Error("Stripe did not return a checkout client secret");
    const binding = await bindSecureStripeSession(intent, session.id, session.expires_at);
    if (binding === "account_deletion_pending") return { kind: "account_deletion_pending" };
    if (binding !== "bound") return { kind: "review" };
    return { kind: "resume", clientSecret: session.client_secret };
  }

  if (session.status === "complete") {
    await transitionIntent(intent, "awaiting_payment", ["creating", "open", "awaiting_payment"]);
    return { kind: "pending" };
  }

  if (session.status === "expired") {
    await transitionIntent(intent, "expired", ["creating", "open"]);
    return { kind: "expired" };
  }

  await transitionIntent(intent, "requires_review", ["creating", "open", "awaiting_payment"]);
  return { kind: "review" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    const environment = getStripeEnvironment();
    const request = validateCheckoutRequest(body, environment);
    if (!request.ok) return jsonResponse(request.response, request.status);
    const { catalogEntry, priceId } = request.value;

    if (await hasBlockingBillingState(user.id, environment)) {
      return jsonResponse({
        code: "billing_already_active",
        error: "You already have an active or pending plan. Manage it from Settings.",
      }, 409);
    }

    const stripe = createStripeClient(environment);
    const prices = await stripe.prices.list({ lookup_keys: [priceId], active: true, limit: 1 });
    const stripePrice = prices.data[0];
    if (!matchesCatalogStripePrice(stripePrice, priceId)) {
      console.error("[create-checkout] configured catalog price is unavailable", {
        environment,
        priceLookupKey: priceId,
      });
      return jsonResponse({ error: "That plan is not currently available." }, 503);
    }

    // A locally-expired intent can be replaced once. Any other unresolved state
    // must resume or block, never create another Checkout Session.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const intent = await acquireCheckoutIntent(
        user.id,
        environment,
        priceId,
        catalogEntry.mode,
        stripePrice.id,
        user.email ?? null,
      );

      if (intent.state === "account_deletion_pending") {
        return jsonResponse({
          code: "account_deletion_pending",
          error: "Your account deletion is being safely completed, so a new payment cannot be started.",
        }, 409);
      }

      if (intent.state === "awaiting_payment") {
        return jsonResponse({
          code: "checkout_pending",
          error: "Your payment is still being confirmed. Please do not submit another payment.",
        }, 409);
      }
      if (intent.state === "requires_review") {
        return jsonResponse({
          code: "billing_needs_review",
          error: "We need to check an existing billing record before another payment can be started.",
        }, 409);
      }

      const existingSession = await resolveExistingStripeSession(intent, user.id, stripe);
      if (existingSession?.kind === "resume") {
        return jsonResponse({
          clientSecret: existingSession.clientSecret,
          environment,
          priceId: intent.price_lookup_key,
          resumed: true,
        });
      }
      if (existingSession?.kind === "account_deletion_pending") {
        return jsonResponse({
          code: "account_deletion_pending",
          error: "Your account deletion is being safely completed, so this payment cannot be resumed.",
        }, 409);
      }
      if (existingSession?.kind === "pending") {
        return jsonResponse({
          code: "checkout_pending",
          error: "Your payment is still being confirmed. Please do not submit another payment.",
        }, 409);
      }
      if (existingSession?.kind === "review") {
        return jsonResponse({
          code: "billing_needs_review",
          error: "We need to check an existing billing record before another payment can be started.",
        }, 409);
      }
      if (existingSession?.kind === "expired") continue;

      const expiresAtSeconds = Math.floor(Date.parse(intent.expires_at) / 1000);
      if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= Math.floor(Date.now() / 1000)) {
        await transitionIntent(intent, "expired", ["creating", "open"]);
        continue;
      }

      // All parameters come from the durable intent so a retry uses exactly the
      // same Stripe idempotency payload even if a price or email changes later.
      const session = await stripe.checkout.sessions.create({
        client_reference_id: user.id,
        ...(intent.customer_email ? { customer_email: intent.customer_email } : {}),
        expires_at: expiresAtSeconds,
        line_items: [{ price: intent.stripe_price_id, quantity: 1 }],
        metadata: {
          checkoutIntentId: intent.id,
          priceLookupKey: intent.price_lookup_key,
          userId: user.id,
        },
        mode: intent.checkout_mode,
        return_url: getCheckoutReturnUrl(),
        ui_mode: "embedded",
        // This is never an entitlement grant. It is a server-written locator
        // for a refund webhook that may arrive before checkout completion; the
        // webhook still proves the exact stored Checkout Session owns the
        // PaymentIntent before it can revoke access.
        ...(intent.checkout_mode === "payment" && {
          payment_intent_data: {
            metadata: {
              checkoutIntentId: intent.id,
              priceLookupKey: intent.price_lookup_key,
              userId: user.id,
            },
          },
        }),
        ...(intent.checkout_mode === "subscription" && {
          subscription_data: {
            metadata: {
              checkoutIntentId: intent.id,
              priceLookupKey: intent.price_lookup_key,
              userId: user.id,
            },
          },
        }),
      }, {
        idempotencyKey: checkoutIntentIdempotencyKey(intent.id),
      });

      if (!session.client_secret) throw new Error("Stripe did not return a checkout client secret");
      const binding = await bindSecureStripeSession(intent, session.id, session.expires_at);
      if (binding === "account_deletion_pending") {
        return jsonResponse({
          code: "account_deletion_pending",
          error: "Your account deletion is being safely completed, so a new payment cannot be started.",
        }, 409);
      }
      if (binding !== "bound") {
        return jsonResponse({
          code: "billing_needs_review",
          error: "We need to check an existing billing record before another payment can be started.",
        }, 409);
      }

      return jsonResponse({
        clientSecret: session.client_secret,
        environment,
        priceId: intent.price_lookup_key,
        resumed: false,
      });
    }

    return jsonResponse({ error: "That checkout session has expired. Please try again." }, 409);
  } catch (error) {
    // Do not mark a `creating` intent failed after a Stripe network error. Its
    // idempotency key may still recover the one existing Checkout Session.
    console.error("[create-checkout] failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse({ error: "Unable to start checkout. Please try again." }, 500);
  }
});
