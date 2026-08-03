import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { partitionSecureOwnedPayslipPaths } from "../_shared/account-deletion.ts";
import {
  createStripeClient,
  getCheckoutIntentId,
  getPriceCatalogEntry,
  getStripeEnvironment,
} from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

const STORAGE_DELETE_BATCH_SIZE = 100;
const PAYSLIP_QUERY_PAGE_SIZE = 1_000;

interface StoredSubscription {
  environment: string;
  price_id: string | null;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface StoredSubscriptionCandidate {
  price_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface StoredPayslip {
  file_path: string | null;
}

interface StoredCheckoutIntent {
  id: string;
  environment: string;
  price_lookup_key: string;
  checkout_mode: "payment" | "subscription";
  state: "creating" | "open" | "awaiting_payment" | "requires_review";
  stripe_checkout_session_id: string | null;
}

class AccountDeletionBlockedError extends Error {
  constructor(
    message: string,
    readonly code: "checkout_pending" | "billing_needs_review",
  ) {
    super(message);
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || null;
}

const NONTERMINAL_STRIPE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

function isStoredSubscriptionCandidate(subscription: StoredSubscription) {
  return NONTERMINAL_STRIPE_SUBSCRIPTION_STATUSES.has(subscription.status)
    && typeof subscription.stripe_subscription_id === "string"
    && subscription.stripe_subscription_id.startsWith("sub_");
}

async function cancelVerifiedStripeSubscription(
  candidate: StoredSubscriptionCandidate,
  userId: string,
  stripe: ReturnType<typeof createStripeClient>,
) {
  if (!candidate.stripe_subscription_id?.startsWith("sub_")) return;

  const remoteSubscription = await stripe.subscriptions.retrieve(
    candidate.stripe_subscription_id,
    { expand: ["items.data.price"] },
  );

  // An old local row may already be terminal at Stripe. There is no further
  // charge to cancel and no reason to let a stale record block account removal.
  if (!NONTERMINAL_STRIPE_SUBSCRIPTION_STATUSES.has(remoteSubscription.status)) return;

  const remotePrice = remoteSubscription.items.data[0]?.price;
  const priceLookupKey = typeof remotePrice === "string" ? null : remotePrice?.lookup_key ?? null;
  const catalogEntry = getPriceCatalogEntry(priceLookupKey);
  const remoteCustomerId = typeof remoteSubscription.customer === "string"
    ? remoteSubscription.customer
    : null;

  if (
    !remoteCustomerId
    || (candidate.stripe_customer_id && remoteCustomerId !== candidate.stripe_customer_id)
    || remoteSubscription.metadata?.userId !== userId
    || catalogEntry?.mode !== "subscription"
    || (candidate.price_id !== null && priceLookupKey !== candidate.price_id)
  ) {
    throw new Error("Could not verify ownership of a current subscription");
  }

  await stripe.subscriptions.cancel(remoteSubscription.id);
}

async function cancelVerifiedStripeSubscriptions(userId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("environment, price_id, status, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .in("status", [...NONTERMINAL_STRIPE_SUBSCRIPTION_STATUSES]);

  if (error) throw new Error("Could not load subscriptions for account deletion");

  const activeSubscriptions = ((data ?? []) as StoredSubscription[])
    .filter(isStoredSubscriptionCandidate);

  // Historical accounts may still have the predecessor table. It is never an
  // entitlement source, but a remotely-current record must still be cancelled
  // before deleting the account. The remote subscription, catalogue and owner
  // checks above prevent a legacy row from targeting someone else's billing.
  const { data: legacy, error: legacyError } = await supabase
    .from("billing_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (legacyError) throw new Error("Could not load legacy subscription for account deletion");

  const legacySubscription = legacy?.stripe_subscription_id?.startsWith("sub_")
    ? {
      stripe_customer_id: legacy.stripe_customer_id,
      stripe_subscription_id: legacy.stripe_subscription_id,
      price_id: null,
    }
    : null;
  if (activeSubscriptions.length === 0 && !legacySubscription) return;

  const environment = getStripeEnvironment();
  if (activeSubscriptions.some((subscription) => subscription.environment !== environment)) {
    throw new Error("Active subscription is outside the configured billing environment");
  }

  const stripe = createStripeClient(environment);
  const processedSubscriptionIds = new Set<string>();
  for (const storedSubscription of activeSubscriptions) {
    if (!storedSubscription.stripe_subscription_id) continue;
    processedSubscriptionIds.add(storedSubscription.stripe_subscription_id);
    await cancelVerifiedStripeSubscription(storedSubscription, userId, stripe);
  }

  if (
    legacySubscription
    && !processedSubscriptionIds.has(legacySubscription.stripe_subscription_id)
  ) {
    await cancelVerifiedStripeSubscription(legacySubscription, userId, stripe);
  }
}

async function expireOpenCheckoutSessionsBeforeDeletion(userId: string) {
  const { data, error } = await supabase
    .from("checkout_intents")
    .select("id, environment, price_lookup_key, checkout_mode, state, stripe_checkout_session_id")
    .eq("user_id", userId)
    .in("state", ["creating", "open", "awaiting_payment", "requires_review"]);

  if (error) throw new Error("Could not load checkout sessions for account deletion");
  const intents = (data ?? []) as StoredCheckoutIntent[];
  if (intents.length === 0) return;

  const environment = getStripeEnvironment();
  if (intents.some((intent) => intent.environment !== environment)) {
    throw new AccountDeletionBlockedError(
      "A checkout is open in another billing environment. Please contact support before deleting this account.",
      "billing_needs_review",
    );
  }

  if (intents.some((intent) => intent.state === "awaiting_payment" || intent.state === "requires_review")) {
    throw new AccountDeletionBlockedError(
      "A payment is still being confirmed. Please wait for it to finish before deleting this account.",
      "checkout_pending",
    );
  }

  if (intents.some((intent) => intent.state === "creating")) {
    // A request may be between reserving an intent and receiving Stripe's
    // response. Deleting now could leave a charge with no account to receive
    // the entitlement, so deliberately fail closed.
    throw new AccountDeletionBlockedError(
      "A checkout is still being prepared. Please wait a moment and try again.",
      "checkout_pending",
    );
  }

  const stripe = createStripeClient(environment);
  for (const intent of intents) {
    if (!intent.stripe_checkout_session_id) {
      throw new AccountDeletionBlockedError(
        "A checkout is still being prepared. Please wait a moment and try again.",
        "checkout_pending",
      );
    }

    const session = await stripe.checkout.sessions.retrieve(intent.stripe_checkout_session_id);
    const belongsToCaller = session.client_reference_id === userId
      && session.metadata?.userId === userId
      && getCheckoutIntentId(session.metadata) === intent.id
      && session.metadata?.priceLookupKey === intent.price_lookup_key
      && session.mode === intent.checkout_mode;
    if (!belongsToCaller) {
      throw new Error("Could not verify ownership of an open checkout session");
    }

    if (session.status === "open") {
      await stripe.checkout.sessions.expire(session.id);
    } else if (session.status !== "expired") {
      throw new AccountDeletionBlockedError(
        "A checkout has already completed and is being confirmed. Please try again shortly.",
        "checkout_pending",
      );
    }

    const { error: updateError } = await supabase
      .from("checkout_intents")
      .update({ state: "expired", updated_at: new Date().toISOString() })
      .eq("id", intent.id)
      .eq("user_id", userId)
      .eq("environment", environment)
      .eq("stripe_checkout_session_id", session.id)
      .eq("state", "open");
    if (updateError) throw new Error("Could not close checkout state before account deletion");
  }
}

async function deleteSecureOwnedPayslipFiles(userId: string) {
  const removedPaths = new Set<string>();
  let rejectedPathCount = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("payslips")
      .select("file_path")
      .eq("user_id", userId)
      .order("id")
      .range(offset, offset + PAYSLIP_QUERY_PAGE_SIZE - 1);

    if (error) throw new Error("Could not load payslip files for account deletion");

    const payslips = (data ?? []) as StoredPayslip[];
    const partition = partitionSecureOwnedPayslipPaths(
      payslips.map((payslip) => payslip.file_path),
      userId,
    );
    rejectedPathCount += partition.rejectedPathCount;
    const paths = partition.paths.filter((path) => !removedPaths.has(path));

    for (let start = 0; start < paths.length; start += STORAGE_DELETE_BATCH_SIZE) {
      const batch = paths.slice(start, start + STORAGE_DELETE_BATCH_SIZE);
      const { error: storageError } = await supabase.storage.from("payslips").remove(batch);

      if (storageError) throw new Error("Could not remove payslip files for account deletion");
      batch.forEach((path) => removedPaths.add(path));
    }

    if (payslips.length < PAYSLIP_QUERY_PAGE_SIZE) break;
    offset += payslips.length;
  }

  if (rejectedPathCount > 0) {
    // Never use service-role storage access on a path outside the caller's
    // namespace. The row is removed by the auth-user cascade below.
    console.warn("[delete-account] skipped unsafe payslip storage paths", { rejectedPathCount });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    await expireOpenCheckoutSessionsBeforeDeletion(user.id);
    await cancelVerifiedStripeSubscriptions(user.id);
    await deleteSecureOwnedPayslipFiles(user.id);

    // Hard-delete the auth user. All application tables reference auth.users
    // with ON DELETE CASCADE, so cleanup is server-side and atomic at the DB
    // boundary; do not soft-delete because that would retain application rows.
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteUserError) throw new Error("Could not delete account");

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof AccountDeletionBlockedError) {
      return jsonResponse({ error: error.message, code: error.code }, 409);
    }
    console.error("[delete-account] failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse({ error: "Unable to delete the account. Please try again or contact support." }, 500);
  }
});
