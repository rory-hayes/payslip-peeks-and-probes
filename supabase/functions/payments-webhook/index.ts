// Release deployment sync: keep this reviewed function aligned with the repository revision.
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createStripeClient,
  getCheckoutIntentId,
  getPriceCatalogEntry,
  getStripeEnvironment,
  matchesCatalogStripePrice,
  type StripeEnv,
  verifyWebhook,
} from "../_shared/stripe.ts";
import {
  isFullyRefundedCharge,
  matchesBoundCheckoutIntent,
  matchesBoundLifetimeCheckoutPayment,
  type LifetimeCheckoutIntentBinding,
} from "../_shared/checkout-intent.ts";

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
  | "requires_review"
  | "refunded";

interface StoredCheckoutIntent extends LifetimeCheckoutIntentBinding {
  id: string;
  user_id: string;
  environment: StripeEnv;
  price_lookup_key: string;
  checkout_mode: "payment" | "subscription";
  stripe_checkout_session_id: string | null;
  state: CheckoutIntentState;
}

const RECONCILABLE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getStripeObjectId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function stringValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isUuid(value: string | null): value is string {
  return value !== null && UUID_PATTERN.test(value);
}

interface DeletionBillingReviewInput {
  subjectUserId: string;
  environment: StripeEnv;
  checkoutIntentId: string;
  checkoutMode: "payment" | "subscription";
  priceLookupKey: string;
  sessionId?: string | null;
  paymentIntentId?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  stripeEventId: string;
  eventType: string;
  remoteStatus?: string | null;
}

async function recordAccountDeletionBillingReview(
  input: DeletionBillingReviewInput,
): Promise<"recorded" | "no_deletion"> {
  const { data, error } = await supabase.rpc("record_account_deletion_billing_review", {
    p_subject_user_id: input.subjectUserId,
    p_environment: input.environment,
    p_checkout_intent_id: input.checkoutIntentId,
    p_checkout_mode: input.checkoutMode,
    p_price_lookup_key: input.priceLookupKey,
    p_stripe_checkout_session_id: input.sessionId ?? null,
    p_stripe_payment_intent_id: input.paymentIntentId ?? null,
    p_stripe_subscription_id: input.subscriptionId ?? null,
    p_stripe_customer_id: input.customerId ?? null,
    p_stripe_event_id: input.stripeEventId,
    p_event_type: input.eventType,
    p_remote_status: input.remoteStatus ?? null,
  });

  if (error || (data !== "recorded" && data !== "no_deletion")) {
    throw new Error("Could not preserve a deletion-time billing event");
  }
  return data;
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
    && (typeof record.stripe_payment_intent_id === "string" || record.stripe_payment_intent_id === null)
    && typeof record.state === "string";
}

async function loadCheckoutIntent(
  intentId: string,
  userId: string,
  environment: StripeEnv,
): Promise<StoredCheckoutIntent | null> {
  const { data, error } = await supabase
    .from("checkout_intents")
    .select("id, user_id, environment, price_lookup_key, checkout_mode, stripe_checkout_session_id, stripe_payment_intent_id, state")
    .eq("id", intentId)
    .eq("user_id", userId)
    .eq("environment", environment)
    .maybeSingle();

  if (error) throw new Error("Could not load checkout intent");
  if (!data) return null;
  if (!isStoredCheckoutIntent(data)) throw new Error("Checkout intent had an invalid shape");
  return data;
}

async function loadCheckoutIntentById(
  intentId: string,
  environment: StripeEnv,
): Promise<StoredCheckoutIntent | null> {
  const { data, error } = await supabase
    .from("checkout_intents")
    .select("id, user_id, environment, price_lookup_key, checkout_mode, stripe_checkout_session_id, stripe_payment_intent_id, state")
    .eq("id", intentId)
    .eq("environment", environment)
    .maybeSingle();

  if (error) throw new Error("Could not load checkout intent");
  if (!data) return null;
  if (!isStoredCheckoutIntent(data)) throw new Error("Checkout intent had an invalid shape");
  return data;
}

async function loadCheckoutIntentByPaymentIntent(
  paymentIntentId: string,
  environment: StripeEnv,
): Promise<StoredCheckoutIntent | null> {
  const { data, error } = await supabase
    .from("checkout_intents")
    .select("id, user_id, environment, price_lookup_key, checkout_mode, stripe_checkout_session_id, stripe_payment_intent_id, state")
    .eq("environment", environment)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (error) throw new Error("Could not load checkout intent for a Stripe payment");
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
  state: "awaiting_payment" | "succeeded" | "failed" | "requires_review",
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
    requires_review: ["creating", "open", "awaiting_payment", "requires_review"],
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
  const metadataUserId = session.metadata?.userId ?? null;
  const checkoutIntentId = getCheckoutIntentId(session.metadata);

  if (
    !catalogEntry
    || !priceLookupKey
    || !isUuid(metadataUserId)
    || !isUuid(checkoutIntentId)
    || session.client_reference_id !== metadataUserId
    || session.mode !== catalogEntry.mode
    || !matchesCatalogStripePrice(price, priceLookupKey)
  ) {
    console.error("[payments-webhook] ignored checkout outside the configured catalog", {
      environment,
      mode: session.mode,
      priceLookupKey,
    });
    return null;
  }

  const intent = await loadCheckoutIntent(checkoutIntentId, metadataUserId, environment);
  const isBound = matchesBoundCheckoutIntent(intent, {
    checkoutIntentId,
    checkoutMode: catalogEntry.mode,
    environment,
    priceLookupKey,
    sessionId: session.id,
    userId: metadataUserId,
  });

  if (!isBound) {
    // A local checkout can disappear when Auth deletion wins the race. The
    // Stripe object is still fully verified against this app's server-written
    // metadata and catalogue, but it is never eligible for entitlement.
    console.error("[payments-webhook] verified checkout has no bound app intent", { environment });
  }

  return {
    catalogEntry,
    checkoutIntentId,
    metadataUserId,
    priceLookupKey,
    session,
    intent: isBound ? intent : null,
  };
}

/**
 * Subscription events have their own Stripe object, so reconnect them to the
 * app-created Checkout Session before they can create or extend entitlement.
 * If account deletion cascaded the intent away, the verified Stripe object is
 * returned as unbound so it can enter the durable deletion-review ledger.
 */
async function resolveSubscriptionContext(
  eventObject: Record<string, unknown>,
  environment: StripeEnv,
) {
  const subscriptionId = stringValue(eventObject, "id");
  if (!subscriptionId) return null;

  const stripe = createStripeClient(environment);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const price = subscription.items.data[0]?.price;
  const priceLookupKey = typeof price === "string" ? null : price?.lookup_key ?? null;
  const catalogEntry = getPriceCatalogEntry(priceLookupKey);
  const userId = subscription.metadata?.userId ?? null;
  const checkoutIntentId = getCheckoutIntentId(subscription.metadata);

  if (
    !catalogEntry
    || catalogEntry.mode !== "subscription"
    || !priceLookupKey
    || !isUuid(userId)
    || !isUuid(checkoutIntentId)
    || !matchesCatalogStripePrice(price, priceLookupKey)
  ) {
    console.error("[payments-webhook] ignored subscription outside the configured catalog", {
      environment,
      priceLookupKey,
    });
    return null;
  }

  const intent = await loadCheckoutIntent(checkoutIntentId, userId, environment);
  if (!intent?.stripe_checkout_session_id) {
    console.error("[payments-webhook] verified subscription has no bound app intent", { environment });
    return {
      catalogEntry,
      checkoutIntentId,
      priceLookupKey,
      subscription,
      userId,
      intent: null,
      session: null,
    };
  }

  const session = await stripe.checkout.sessions.retrieve(intent.stripe_checkout_session_id);
  const sessionSubscriptionId = getStripeObjectId(session.subscription);
  const isBound = matchesBoundCheckoutIntent(intent, {
    checkoutIntentId,
    checkoutMode: "subscription",
    environment,
    priceLookupKey,
    sessionId: session.id,
    userId,
  })
    && session.client_reference_id === userId
    && session.metadata?.userId === userId
    && getCheckoutIntentId(session.metadata) === checkoutIntentId
    && session.metadata?.priceLookupKey === priceLookupKey
    && session.mode === "subscription"
    && sessionSubscriptionId === subscription.id;

  if (!isBound) {
    console.error("[payments-webhook] verified subscription did not match its app checkout", { environment });
  }

  return {
    catalogEntry,
    checkoutIntentId,
    priceLookupKey,
    subscription,
    userId,
    intent: isBound ? intent : null,
    session: isBound ? session : null,
  };
}

type VerifiedCheckoutContext = NonNullable<Awaited<ReturnType<typeof resolveCheckoutContext>>>;
type BoundCheckoutContext = VerifiedCheckoutContext & { intent: StoredCheckoutIntent };

async function reconcileLifetimePaymentDuringDeletion(
  checkout: VerifiedCheckoutContext,
  paymentIntentId: string | null,
  environment: StripeEnv,
  stripeEventId: string,
  eventType: string,
  remoteStatus: string | null,
) {
  return recordAccountDeletionBillingReview({
    subjectUserId: checkout.metadataUserId,
    environment,
    checkoutIntentId: checkout.checkoutIntentId,
    checkoutMode: "payment",
    priceLookupKey: checkout.priceLookupKey,
    sessionId: checkout.session.id,
    paymentIntentId,
    stripeEventId,
    eventType,
    remoteStatus,
  });
}

async function grantLifetimeEntitlement(
  checkout: BoundCheckoutContext,
  paymentIntentId: string,
  environment: StripeEnv,
  stripeEventId: string,
  eventType: string,
) {

  // Record the payment ID before granting access. A refund webhook can arrive
  // before checkout completion; the database transaction then turns this
  // intent terminal and a later grant safely becomes a no-op.
  const { data: paymentIntentOutcome, error: paymentIntentError } = await supabase.rpc(
    "record_secure_lifetime_payment_intent_with_reconciliation",
    {
      p_intent_id: checkout.checkoutIntentId,
      p_user_id: checkout.metadataUserId,
      p_environment: environment,
      p_price_lookup_key: checkout.priceLookupKey,
      p_session_id: checkout.session.id,
      p_payment_intent_id: paymentIntentId,
    },
  );

  if (paymentIntentError) throw new Error("Could not bind Stripe PaymentIntent to its checkout");
  if (paymentIntentOutcome === "account_deletion_pending") {
    await reconcileLifetimePaymentDuringDeletion(
      checkout,
      paymentIntentId,
      environment,
      stripeEventId,
      eventType,
      "paid",
    );
    console.error("[payments-webhook] lifetime payment settled during account deletion", { environment });
    return;
  }
  if (paymentIntentOutcome === "refunded") {
    console.info("[payments-webhook] skipped lifetime grant after a verified refund", { environment });
    return;
  }
  if (paymentIntentOutcome !== "recorded") {
    const reviewOutcome = await reconcileLifetimePaymentDuringDeletion(
      checkout,
      paymentIntentId,
      environment,
      stripeEventId,
      eventType,
      "paid",
    );
    if (reviewOutcome === "recorded") {
      console.error("[payments-webhook] lifetime payment was retained for deletion reconciliation", { environment });
      return;
    }
    console.error("[payments-webhook] lifetime payment intent needs reconciliation", {
      environment,
      outcome: typeof paymentIntentOutcome === "string" ? paymentIntentOutcome : "unknown",
    });
    return;
  }

  const { data, error } = await supabase.rpc("grant_secure_lifetime_entitlement", {
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
  if (outcome === "account_deletion_pending") {
    await reconcileLifetimePaymentDuringDeletion(
      checkout,
      paymentIntentId,
      environment,
      stripeEventId,
      eventType,
      "paid",
    );
    console.error("[payments-webhook] lifetime entitlement blocked by account deletion", { environment });
    return;
  }
  if (outcome === "refunded") {
    console.info("[payments-webhook] skipped lifetime grant after a verified refund", { environment });
    return;
  }

  const reviewOutcome = await reconcileLifetimePaymentDuringDeletion(
    checkout,
    paymentIntentId,
    environment,
    stripeEventId,
    eventType,
    "paid",
  );
  if (reviewOutcome === "recorded") {
    console.error("[payments-webhook] lifetime entitlement was retained for deletion reconciliation", { environment });
    return;
  }

  // An active-account ambiguity stays in its durable checkout-intent review
  // state. Never grant entitlement from a non-success outcome.
  console.error("[payments-webhook] lifetime payment needs reconciliation", {
    environment,
    outcome: outcome ?? "unknown",
  });
}

/**
 * A refund object only names a PaymentIntent. Resolve it through a durable
 * local payment binding when present; if the refund wins the checkout event,
 * use server-written PaymentIntent metadata only to locate a candidate and
 * then prove the original stored Checkout Session owns that exact payment.
 */
async function resolveLifetimeRefundContext(paymentIntentId: string, environment: StripeEnv) {
  const stripe = createStripeClient(environment);
  let intent = await loadCheckoutIntentByPaymentIntent(paymentIntentId, environment);

  if (!intent) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const candidateIntentId = getCheckoutIntentId(paymentIntent.metadata);
    if (!candidateIntentId) {
      console.warn("[payments-webhook] refund has no app payment-intent locator", { environment });
      return null;
    }
    intent = await loadCheckoutIntentById(candidateIntentId, environment);
  }

  if (!intent || intent.checkout_mode !== "payment" || !intent.stripe_checkout_session_id) {
    console.warn("[payments-webhook] refund has no matching lifetime checkout intent", { environment });
    return null;
  }

  const checkout = await resolveCheckoutContext(
    { id: intent.stripe_checkout_session_id },
    environment,
  );
  if (
    !checkout
    || checkout.catalogEntry.mode !== "payment"
    || checkout.checkoutIntentId !== intent.id
    || getStripeObjectId(checkout.session.payment_intent) !== paymentIntentId
    || !matchesBoundLifetimeCheckoutPayment(intent, {
      checkoutIntentId: checkout.checkoutIntentId,
      checkoutMode: "payment",
      environment,
      priceLookupKey: checkout.priceLookupKey,
      sessionId: checkout.session.id,
      userId: checkout.metadataUserId,
      paymentIntentId,
    })
  ) {
    console.error("[payments-webhook] refund did not match its app checkout", { environment });
    return null;
  }

  return { checkout, intent };
}

async function reconcileUnboundLifetimeRefund(
  stripe: ReturnType<typeof createStripeClient>,
  paymentIntentId: string,
  environment: StripeEnv,
  stripeEventId: string,
  eventType: string,
) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const userId = paymentIntent.metadata?.userId ?? null;
  const checkoutIntentId = getCheckoutIntentId(paymentIntent.metadata);
  const priceLookupKey = paymentIntent.metadata?.priceLookupKey ?? null;
  const catalogEntry = getPriceCatalogEntry(priceLookupKey);
  if (
    !isUuid(userId)
    || !isUuid(checkoutIntentId)
    || !priceLookupKey
    || catalogEntry?.mode !== "payment"
  ) {
    console.warn("[payments-webhook] refunded payment has no verified app reconciliation locator", { environment });
    return;
  }

  const outcome = await recordAccountDeletionBillingReview({
    subjectUserId: userId,
    environment,
    checkoutIntentId,
    checkoutMode: "payment",
    priceLookupKey,
    paymentIntentId,
    stripeEventId,
    eventType,
    remoteStatus: "fully_refunded",
  });
  if (outcome === "recorded") {
    console.error("[payments-webhook] unbound lifetime refund retained for deletion reconciliation", { environment });
  } else {
    console.error("[payments-webhook] ignored verified but unbound lifetime refund outside deletion", { environment });
  }
}

async function reconcileUnboundCheckoutEvent(
  checkout: VerifiedCheckoutContext,
  eventType: string,
  environment: StripeEnv,
  stripeEventId: string,
) {
  if (eventType === "checkout.session.expired" || eventType === "checkout.session.async_payment_failed") {
    console.warn("[payments-webhook] verified but unbound checkout ended without a settled payment", { environment });
    return;
  }

  if (checkout.catalogEntry.mode === "payment") {
    if (checkout.session.payment_status !== "paid") {
      console.warn("[payments-webhook] verified but unbound lifetime checkout is not settled", { environment });
      return;
    }
    const outcome = await reconcileLifetimePaymentDuringDeletion(
      checkout,
      getStripeObjectId(checkout.session.payment_intent),
      environment,
      stripeEventId,
      eventType,
      checkout.session.payment_status,
    );
    if (outcome === "recorded") {
      console.error("[payments-webhook] unbound lifetime payment retained for deletion reconciliation", { environment });
    } else {
      console.error("[payments-webhook] ignored verified but unbound lifetime payment outside deletion", { environment });
    }
    return;
  }

  const outcome = await recordAccountDeletionBillingReview({
    subjectUserId: checkout.metadataUserId,
    environment,
    checkoutIntentId: checkout.checkoutIntentId,
    checkoutMode: "subscription",
    priceLookupKey: checkout.priceLookupKey,
    sessionId: checkout.session.id,
    subscriptionId: getStripeObjectId(checkout.session.subscription),
    customerId: typeof checkout.session.customer === "string" ? checkout.session.customer : null,
    stripeEventId,
    eventType,
    remoteStatus: checkout.session.status,
  });
  if (outcome === "recorded") {
    console.error("[payments-webhook] unbound subscription checkout retained for deletion reconciliation", { environment });
  } else {
    console.error("[payments-webhook] ignored verified but unbound subscription checkout outside deletion", { environment });
  }
}

async function handleCheckoutSessionEvent(
  eventType: string,
  eventObject: Record<string, unknown>,
  environment: StripeEnv,
  stripeEventId: string,
) {
  const checkout = await resolveCheckoutContext(eventObject, environment);
  if (!checkout) return;

  if (!checkout.intent) {
    await reconcileUnboundCheckoutEvent(checkout, eventType, environment, stripeEventId);
    return;
  }
  const boundCheckout = checkout as BoundCheckoutContext;

  const sessionState = eventType === "checkout.session.expired"
    ? "expired"
    : eventType === "checkout.session.async_payment_failed"
      ? "failed"
      : "awaiting_payment";

  if (boundCheckout.catalogEntry.mode === "subscription") {
    if (eventType !== "checkout.session.expired" && eventType !== "checkout.session.async_payment_failed") {
      const reviewOutcome = await recordAccountDeletionBillingReview({
        subjectUserId: boundCheckout.metadataUserId,
        environment,
        checkoutIntentId: boundCheckout.checkoutIntentId,
        checkoutMode: "subscription",
        priceLookupKey: boundCheckout.priceLookupKey,
        sessionId: boundCheckout.session.id,
        subscriptionId: getStripeObjectId(boundCheckout.session.subscription),
        customerId: typeof boundCheckout.session.customer === "string" ? boundCheckout.session.customer : null,
        stripeEventId,
        eventType,
        remoteStatus: boundCheckout.session.status,
      });
      if (reviewOutcome === "recorded") {
        console.error("[payments-webhook] subscription checkout retained for deletion reconciliation", { environment });
        return;
      }
    }
    await markCheckoutSessionIntent(
      boundCheckout.checkoutIntentId,
      boundCheckout.metadataUserId,
      environment,
      boundCheckout.priceLookupKey,
      "subscription",
      boundCheckout.session.id,
      sessionState,
    );
    return;
  }

  if (eventType === "checkout.session.expired" || eventType === "checkout.session.async_payment_failed") {
    await markCheckoutSessionIntent(
      boundCheckout.checkoutIntentId,
      boundCheckout.metadataUserId,
      environment,
      boundCheckout.priceLookupKey,
      "payment",
      boundCheckout.session.id,
      sessionState,
    );
    return;
  }

  // `checkout.session.completed` means the hosted flow finished, not that a
  // delayed method settled. A payment-mode entitlement is granted only after
  // Stripe's authoritative retrieved Checkout Session says it is paid.
  if (boundCheckout.session.payment_status !== "paid") {
    await markCheckoutSessionIntent(
      boundCheckout.checkoutIntentId,
      boundCheckout.metadataUserId,
      environment,
      boundCheckout.priceLookupKey,
      "payment",
      boundCheckout.session.id,
      "awaiting_payment",
    );
    return;
  }

  const paymentIntentId = getStripeObjectId(boundCheckout.session.payment_intent);
  if (!paymentIntentId) {
    await markCheckoutSessionIntent(
      boundCheckout.checkoutIntentId,
      boundCheckout.metadataUserId,
      environment,
      boundCheckout.priceLookupKey,
      "payment",
      boundCheckout.session.id,
      "requires_review",
    );
    return;
  }

  await grantLifetimeEntitlement(
    boundCheckout,
    paymentIntentId,
    environment,
    stripeEventId,
    eventType,
  );
}

/**
 * Stripe must deliver both `refund.created` and `refund.updated` to this
 * endpoint. We act only after a refetched Refund is settled and the refetched
 * Charge proves the complete lifetime payment was returned.
 */
async function handleLifetimeRefund(
  eventObject: Record<string, unknown>,
  environment: StripeEnv,
  stripeEventId: string,
  eventType: string,
) {
  const refundId = stringValue(eventObject, "id");
  if (!refundId) return;

  const stripe = createStripeClient(environment);
  const refund = await stripe.refunds.retrieve(refundId);
  if (refund.status !== "succeeded") return;

  const refundPaymentIntentId = getStripeObjectId(refund.payment_intent);
  const chargeId = getStripeObjectId(refund.charge);
  if (!refundPaymentIntentId || !chargeId) {
    console.warn("[payments-webhook] settled refund has no payment binding", { environment });
    return;
  }

  const charge = await stripe.charges.retrieve(chargeId);
  if (getStripeObjectId(charge.payment_intent) !== refundPaymentIntentId) {
    console.error("[payments-webhook] refund charge did not match its payment intent", { environment });
    return;
  }

  // A partial refund has a business implication but not a universal access
  // rule. Preserve the entitlement and make the event observable rather than
  // silently revoking a customer's lifetime plan.
  if (!isFullyRefundedCharge(charge)) {
    console.warn("[payments-webhook] partial lifetime refund requires manual review", { environment });
    return;
  }

  const refundContext = await resolveLifetimeRefundContext(refundPaymentIntentId, environment);
  if (!refundContext) {
    await reconcileUnboundLifetimeRefund(
      stripe,
      refundPaymentIntentId,
      environment,
      stripeEventId,
      eventType,
    );
    return;
  }

  const { data, error } = await supabase.rpc("revoke_lifetime_entitlement", {
    p_intent_id: refundContext.intent.id,
    p_user_id: refundContext.intent.user_id,
    p_environment: environment,
    p_session_id: refundContext.checkout.session.id,
    p_payment_intent_id: refundPaymentIntentId,
  });
  if (error) throw new Error("Could not revoke a refunded lifetime entitlement");

  const outcome = typeof data === "string" ? data : null;
  if (outcome === "revoked" || outcome === "already_revoked") return;

  console.error("[payments-webhook] refunded lifetime payment needs reconciliation", {
    environment,
    outcome: outcome ?? "unknown",
  });
}

type VerifiedSubscriptionContext = NonNullable<Awaited<ReturnType<typeof resolveSubscriptionContext>>>;
type BoundSubscriptionContext = VerifiedSubscriptionContext & {
  intent: StoredCheckoutIntent;
  session: NonNullable<VerifiedSubscriptionContext["session"]>;
};

async function reconcileSubscriptionDuringDeletion(
  checkout: VerifiedSubscriptionContext,
  environment: StripeEnv,
  stripeEventId: string,
  eventType: string,
) {
  return recordAccountDeletionBillingReview({
    subjectUserId: checkout.userId,
    environment,
    checkoutIntentId: checkout.checkoutIntentId,
    checkoutMode: "subscription",
    priceLookupKey: checkout.priceLookupKey,
    sessionId: checkout.session?.id ?? null,
    subscriptionId: checkout.subscription.id,
    customerId: typeof checkout.subscription.customer === "string" ? checkout.subscription.customer : null,
    stripeEventId,
    eventType,
    remoteStatus: checkout.subscription.status,
  });
}

async function upsertSubscription(
  eventObject: Record<string, unknown>,
  environment: StripeEnv,
  stripeEventId: string,
  eventType: string,
) {
  const checkout = await resolveSubscriptionContext(eventObject, environment);
  if (!checkout) return;

  if (!checkout.intent || !checkout.session) {
    if (!RECONCILABLE_SUBSCRIPTION_STATUSES.has(checkout.subscription.status)) {
      console.info("[payments-webhook] ignored terminal unbound subscription", { environment });
      return;
    }
    const reviewOutcome = await reconcileSubscriptionDuringDeletion(
      checkout,
      environment,
      stripeEventId,
      eventType,
    );
    if (reviewOutcome === "recorded") {
      console.error("[payments-webhook] unbound subscription retained for deletion reconciliation", { environment });
    } else {
      console.error("[payments-webhook] ignored verified but unbound subscription outside deletion", { environment });
    }
    return;
  }

  const boundCheckout = checkout as BoundSubscriptionContext;
  const { catalogEntry, checkoutIntentId, priceLookupKey, subscription, userId } = boundCheckout;
  const { data, error } = await supabase.rpc("upsert_secure_stripe_subscription", {
    p_user_id: userId,
    p_stripe_subscription_id: subscription.id,
    p_stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : "",
    p_product_id: catalogEntry.plan,
    p_price_id: priceLookupKey,
    p_status: subscription.status,
    p_current_period_start: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null,
    p_current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    p_cancel_at_period_end: subscription.cancel_at_period_end || false,
    p_environment: environment,
    p_checkout_intent_id: checkoutIntentId,
    p_stripe_checkout_session_id: boundCheckout.session.id,
  });

  if (error) throw new Error("Could not persist a subscription entitlement");
  if (data === "account_deletion_pending") {
    await reconcileSubscriptionDuringDeletion(boundCheckout, environment, stripeEventId, eventType);
    console.error("[payments-webhook] subscription event settled during account deletion", { environment });
    return;
  }
  if (data !== "upserted") {
    const reviewOutcome = await reconcileSubscriptionDuringDeletion(
      boundCheckout,
      environment,
      stripeEventId,
      eventType,
    );
    if (reviewOutcome === "recorded") {
      console.error("[payments-webhook] subscription retained for deletion reconciliation", { environment });
      return;
    }
    console.error("[payments-webhook] subscription entitlement needs reconciliation", {
      environment,
      outcome: typeof data === "string" ? data : "unknown",
    });
    await markSubscriptionIntent(checkoutIntentId, userId, environment, priceLookupKey, "requires_review");
    return;
  }

  if (subscription.status === "active" || subscription.status === "trialing") {
    await markSubscriptionIntent(checkoutIntentId, userId, environment, priceLookupKey, "succeeded");
  } else if (["incomplete", "past_due", "unpaid", "paused"].includes(subscription.status)) {
    await markSubscriptionIntent(checkoutIntentId, userId, environment, priceLookupKey, "awaiting_payment");
  } else if (["canceled", "incomplete_expired"].includes(subscription.status)) {
    await markSubscriptionIntent(checkoutIntentId, userId, environment, priceLookupKey, "failed");
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
  stripeEventId: string,
) {
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await handleCheckoutSessionEvent(type, eventObject, environment, stripeEventId);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(eventObject, environment, stripeEventId, type);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(eventObject, environment);
      break;
    case "refund.created":
    case "refund.updated":
      await handleLifetimeRefund(eventObject, environment, stripeEventId, type);
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
    await dispatchWebhookEvent(event.type, event.data.object, environment, event.id);
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
