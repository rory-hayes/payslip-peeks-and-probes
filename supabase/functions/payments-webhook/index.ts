import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createStripeClient,
  getCheckoutIntentId,
  getPriceCatalogEntry,
  getStripeEnvironment,
  type StripeEnv,
  verifyWebhook,
} from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type CheckoutIntentState =
  | "creating"
  | "open"
  | "awaiting_payment"
  | "succeeded"
  | "expired"
  | "failed"
  | "requires_review";

interface StoredCheckoutIntent {
  id: string;
  user_id: string;
  environment: StripeEnv;
  price_lookup_key: string;
  checkout_mode: "payment" | "subscription";
  stripe_checkout_session_id: string | null;
  state: CheckoutIntentState;
}

function stringValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isStoredCheckoutIntent(value: unknown): value is StoredCheckoutIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  return typeof record.id === "string"
    && typeof record.user_id === "string"
    && (record.environment === "sandbox" || record.environment === "live")
    && typeof record.price_lookup_key === "string"
    && (record.checkout_mode === "payment" || record.checkout_mode === "subscription")
    && (typeof record.stripe_checkout_session_id === "string" || record.stripe_checkout_session_id === null)
    && typeof record.state === "string";
}

async function loadCheckoutIntent(
  intentId: string,
  userId: string,
  environment: StripeEnv,
): Promise<StoredCheckoutIntent | null> {
  const { data, error } = await supabase
    .from("checkout_intents")
    .select("id, user_id, environment, price_lookup_key, checkout_mode, stripe_checkout_session_id, state")
    .eq("id", intentId)
    .eq("user_id", userId)
    .eq("environment", environment)
    .maybeSingle();

  if (error) throw new Error("Could not load checkout intent");
  if (!data) return null;
  if (!isStoredCheckoutIntent(data)) throw new Error("Checkout intent had an invalid shape");
  return data;
}

async function markCheckoutSessionIntent(
  intentId: string | null,
  userId: string,
  environment: StripeEnv,
  priceLookupKey: string,
  checkoutMode: "payment" | "subscription",
  sessionId: string,
  state: "awaiting_payment" | "expired" | "failed" | "requires_review",
) {
  if (!intentId) return;

  const intent = await loadCheckoutIntent(intentId, userId, environment);
  if (!intent) {
    console.error("[payments-webhook] checkout intent was not found", { environment });
    return;
  }
  if (
    intent.checkout_mode !== checkoutMode
    || intent.price_lookup_key !== priceLookupKey
    || (intent.stripe_checkout_session_id && intent.stripe_checkout_session_id !== sessionId)
  ) {
    console.error("[payments-webhook] checkout intent did not match Stripe session", { environment });
    return;
  }

  const allowedStates: Record<typeof state, CheckoutIntentState[]> = {
    awaiting_payment: ["creating", "open", "awaiting_payment"],
    expired: ["creating", "open"],
    failed: ["creating", "open", "awaiting_payment"],
    requires_review: ["creating", "open", "awaiting_payment"],
  };
  if (!intent.stripe_checkout_session_id) {
    const { error: bindError } = await supabase
      .from("checkout_intents")
      .update({ stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() })
      .eq("id", intent.id)
      .eq("user_id", userId)
      .eq("environment", environment)
      .is("stripe_checkout_session_id", null);
    if (bindError) throw new Error("Could not bind Stripe Checkout Session to its intent");
  }

  // Normally create-checkout records the session before the customer can
  // complete it. If this webhook wins that race, reload the row so a concurrent
  // bind cannot make us silently skip the payment-state transition.
  const storedIntent = await loadCheckoutIntent(intent.id, userId, environment);
  if (storedIntent?.stripe_checkout_session_id !== sessionId) {
    console.error("[payments-webhook] checkout intent session changed during update", { environment });
    return;
  }

  const { error: stateError } = await supabase
    .from("checkout_intents")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", intent.id)
    .eq("user_id", userId)
    .eq("environment", environment)
    .in("state", allowedStates[state]);
  if (stateError) throw new Error("Could not update checkout intent");
}

async function markSubscriptionIntent(
  intentId: string | null,
  userId: string,
  environment: StripeEnv,
  priceLookupKey: string,
  state: "awaiting_payment" | "succeeded" | "failed",
) {
  if (!intentId) return;

  const intent = await loadCheckoutIntent(intentId, userId, environment);
  if (!intent) {
    console.error("[payments-webhook] subscription checkout intent was not found", { environment });
    return;
  }
  if (intent.checkout_mode !== "subscription" || intent.price_lookup_key !== priceLookupKey) {
    console.error("[payments-webhook] subscription intent did not match Stripe subscription", { environment });
    return;
  }

  const allowedStates: Record<typeof state, CheckoutIntentState[]> = {
    awaiting_payment: ["creating", "open", "awaiting_payment"],
    succeeded: ["creating", "open", "awaiting_payment", "succeeded"],
    failed: ["creating", "open", "awaiting_payment"],
  };
  const { error } = await supabase
    .from("checkout_intents")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", intent.id)
    .eq("user_id", userId)
    .eq("environment", environment)
    .in("state", allowedStates[state]);

  if (error) throw new Error("Could not update subscription checkout intent");
}

async function resolveCheckoutContext(
  eventObject: Record<string, unknown>,
  environment: StripeEnv,
) {
  const sessionId = stringValue(eventObject, "id");
  if (!sessionId) return null;

  const stripe = createStripeClient(environment);
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price"],
  });
  const lineItem = session.line_items?.data[0];
  const price = lineItem?.price && typeof lineItem.price !== "string" ? lineItem.price : null;
  const priceLookupKey = price?.lookup_key ?? null;
  const catalogEntry = getPriceCatalogEntry(priceLookupKey);
  const metadataUserId = session.metadata?.userId ?? session.client_reference_id ?? null;

  if (!catalogEntry || !priceLookupKey || !metadataUserId || session.mode !== catalogEntry.mode) {
    console.error("[payments-webhook] ignored checkout outside the configured catalog", {
      environment,
      mode: session.mode,
      priceLookupKey,
    });
    return null;
  }

  return {
    catalogEntry,
    checkoutIntentId: getCheckoutIntentId(session.metadata),
    metadataUserId,
    priceLookupKey,
    session,
  };
}

async function grantLifetimeEntitlement(
  checkout: NonNullable<Awaited<ReturnType<typeof resolveCheckoutContext>>>,
  environment: StripeEnv,
) {
  const { data, error } = await supabase.rpc("grant_lifetime_entitlement", {
    p_intent_id: checkout.checkoutIntentId,
    p_user_id: checkout.metadataUserId,
    p_environment: environment,
    p_session_id: checkout.session.id,
    p_customer_id: typeof checkout.session.customer === "string" ? checkout.session.customer : "",
    p_product_id: checkout.catalogEntry.plan,
    p_price_id: checkout.priceLookupKey,
  });

  if (error) throw new Error("Could not persist a lifetime entitlement");
  const outcome = typeof data === "string" ? data : null;
  if (outcome === "granted") return;

  // A deleted account or an already-paid historical duplicate cannot safely be
  // retried into a second entitlement. The intent remains blocked for manual
  // reconciliation when it still exists.
  console.error("[payments-webhook] lifetime payment needs reconciliation", {
    environment,
    outcome: outcome ?? "unknown",
  });
}

async function handleCheckoutSessionEvent(
  eventType: string,
  eventObject: Record<string, unknown>,
  environment: StripeEnv,
) {
  const checkout = await resolveCheckoutContext(eventObject, environment);
  if (!checkout) return;

  const sessionState = eventType === "checkout.session.expired"
    ? "expired"
    : eventType === "checkout.session.async_payment_failed"
      ? "failed"
      : "awaiting_payment";

  if (checkout.catalogEntry.mode === "subscription") {
    await markCheckoutSessionIntent(
      checkout.checkoutIntentId,
      checkout.metadataUserId,
      environment,
      checkout.priceLookupKey,
      "subscription",
      checkout.session.id,
      sessionState,
    );
    return;
  }

  if (eventType === "checkout.session.expired" || eventType === "checkout.session.async_payment_failed") {
    await markCheckoutSessionIntent(
      checkout.checkoutIntentId,
      checkout.metadataUserId,
      environment,
      checkout.priceLookupKey,
      "payment",
      checkout.session.id,
      sessionState,
    );
    return;
  }

  // `checkout.session.completed` means the hosted flow finished, not that a
  // delayed method settled. A payment-mode entitlement is granted only after
  // Stripe's authoritative retrieved Checkout Session says it is paid.
  if (checkout.session.payment_status !== "paid") {
    await markCheckoutSessionIntent(
      checkout.checkoutIntentId,
      checkout.metadataUserId,
      environment,
      checkout.priceLookupKey,
      "payment",
      checkout.session.id,
      "awaiting_payment",
    );
    return;
  }

  await grantLifetimeEntitlement(checkout, environment);
}

async function upsertSubscription(eventObject: Record<string, unknown>, environment: StripeEnv) {
  const subscriptionId = stringValue(eventObject, "id");
  if (!subscriptionId) return;

  const stripe = createStripeClient(environment);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const price = subscription.items.data[0]?.price;
  const priceLookupKey = typeof price === "string" ? null : price?.lookup_key ?? null;
  const catalogEntry = getPriceCatalogEntry(priceLookupKey);
  const userId = subscription.metadata?.userId ?? null;

  if (!catalogEntry || catalogEntry.mode !== "subscription" || !priceLookupKey || !userId) {
    console.error("[payments-webhook] ignored subscription outside the configured catalog", {
      environment,
      priceLookupKey,
    });
    return;
  }

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : "",
      product_id: catalogEntry.plan,
      price_id: priceLookupKey,
      status: subscription.status,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) throw new Error("Could not persist a subscription entitlement");

  const intentId = getCheckoutIntentId(subscription.metadata);
  if (subscription.status === "active" || subscription.status === "trialing") {
    await markSubscriptionIntent(intentId, userId, environment, priceLookupKey, "succeeded");
  } else if (["incomplete", "past_due", "unpaid", "paused"].includes(subscription.status)) {
    await markSubscriptionIntent(intentId, userId, environment, priceLookupKey, "awaiting_payment");
  } else if (["canceled", "incomplete_expired"].includes(subscription.status)) {
    await markSubscriptionIntent(intentId, userId, environment, priceLookupKey, "failed");
  }
}

async function handleSubscriptionDeleted(eventObject: Record<string, unknown>, environment: StripeEnv) {
  const subscriptionId = stringValue(eventObject, "id");
  if (!subscriptionId) return;

  const stripe = createStripeClient(environment);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const price = subscription.items.data[0]?.price;
  const priceLookupKey = typeof price === "string" ? null : price?.lookup_key ?? null;
  const catalogEntry = getPriceCatalogEntry(priceLookupKey);
  const userId = subscription.metadata?.userId ?? null;

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId)
    .eq("environment", environment);

  if (error) throw new Error("Could not close a subscription entitlement");

  if (catalogEntry?.mode === "subscription" && priceLookupKey && userId) {
    await markSubscriptionIntent(
      getCheckoutIntentId(subscription.metadata),
      userId,
      environment,
      priceLookupKey,
      "failed",
    );
  }
}

async function dispatchWebhookEvent(
  type: string,
  eventObject: Record<string, unknown>,
  environment: StripeEnv,
) {
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await handleCheckoutSessionEvent(type, eventObject, environment);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(eventObject, environment);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(eventObject, environment);
      break;
    case "invoice.payment_failed":
      console.warn("[payments-webhook] subscription payment failed", { environment });
      break;
    default:
      break;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let environment: StripeEnv;
  try {
    environment = getStripeEnvironment();
  } catch (error) {
    console.error("[payments-webhook] configuration failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Webhook configuration error", { status: 500 });
  }

  let event;
  try {
    event = await verifyWebhook(req, environment);
  } catch (error) {
    console.error("[payments-webhook] verification failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Webhook verification error", { status: 400 });
  }

  try {
    await dispatchWebhookEvent(event.type, event.data.object, environment);
  } catch (error) {
    // Stripe retries non-2xx responses. Do not acknowledge a verified event if
    // our durable billing state could not be updated.
    console.error("[payments-webhook] processing failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Webhook processing error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
