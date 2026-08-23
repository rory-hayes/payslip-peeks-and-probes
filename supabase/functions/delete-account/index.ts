import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AccountDeletionStorageEnumerationError,
  AccountDeletionStoragePathVerificationError,
  enumerateSecureOwnedPayslipStoragePaths,
  requireSecureOwnedPayslipPathsForAccountDeletion,
} from "../_shared/account-deletion.ts";
import { isUuid, secretsMatch } from "../_shared/payslip-upload.ts";
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

interface StoredPayslipUploadSession {
  expires_at: string;
}

interface StoredPayslipReadLinkLease {
  expires_at: string;
}

interface AccountDeletionRequest {
  job_id: string;
  status: string;
}

interface AccountDeletionJobClaim {
  status: string;
  job_id?: string;
  user_id?: string;
  lease_token?: string;
  attempt_count?: number;
  next_attempt_at?: string;
}

interface StoredCheckoutIntent {
  id: string;
  environment: string;
  price_lookup_key: string;
  checkout_mode: "payment" | "subscription";
  state: "creating" | "open" | "awaiting_payment" | "requires_review";
  stripe_checkout_session_id: string | null;
  expires_at: string;
}

class AccountDeletionBlockedError extends Error {
  constructor(
    message: string,
    readonly code: "checkout_pending" | "billing_needs_review" | "payslip_cleanup_needs_review" | "upload_token_pending",
  ) {
    super(message);
  }
}

class AccountDeletionManualReviewError extends Error {
  constructor(readonly code: "billing_needs_review" | "payslip_cleanup_needs_review") {
    super(code === "billing_needs_review"
      ? "A billing record needs a manual review before deletion can continue."
      : "A stored payslip needs a manual review before deletion can continue.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asFutureDate(value: string): Date | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now() ? new Date(timestamp) : null;
}

async function nextActivePayslipUploadExpiry(userId: string): Promise<Date | null> {
  // Supabase signed-upload URLs are bearer credentials that live for two
  // hours. The durable deletion job waits rather than deleting an object while
  // an already-issued bearer credential could recreate it.
  const { data, error } = await supabase
    .from("payslip_upload_sessions")
    .select("expires_at")
    .eq("user_id", userId)
    .in("state", ["issued", "finalized", "cleanup_pending"])
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Could not verify recent secure uploads before account deletion");
  const session = data as StoredPayslipUploadSession | null;
  return session?.expires_at ? asFutureDate(session.expires_at) : null;
}

async function nextActivePayslipReadLinkExpiry(userId: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from("payslip_original_link_leases")
    .select("expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Could not verify recent saved-original links before account deletion");
  const lease = data as StoredPayslipReadLinkLease | null;
  return lease?.expires_at ? asFutureDate(lease.expires_at) : null;
}

async function nextActivePayslipCredentialExpiry(userId: string): Promise<Date | null> {
  const [uploadExpiry, readLinkExpiry] = await Promise.all([
    nextActivePayslipUploadExpiry(userId),
    nextActivePayslipReadLinkExpiry(userId),
  ]);
  if (!uploadExpiry) return readLinkExpiry;
  if (!readLinkExpiry) return uploadExpiry;
  return uploadExpiry <= readLinkExpiry ? uploadExpiry : readLinkExpiry;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" },
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
    throw new AccountDeletionManualReviewError("billing_needs_review");
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

  const currentSubscriptions = (data ?? []) as StoredSubscription[];
  const activeSubscriptions = currentSubscriptions.filter(isStoredSubscriptionCandidate);

  // A paid lifetime row has no cancellable Stripe subscription ID. Deleting
  // the account would otherwise discard the only entitlement record after a
  // successful charge, so require a refund/reconciliation decision instead.
  if (currentSubscriptions.some((subscription) => !isStoredSubscriptionCandidate(subscription))) {
    throw new AccountDeletionManualReviewError("billing_needs_review");
  }

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
    throw new AccountDeletionManualReviewError("billing_needs_review");
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
    .select("id, environment, price_lookup_key, checkout_mode, state, stripe_checkout_session_id, expires_at")
    .eq("user_id", userId)
    .in("state", ["creating", "open", "awaiting_payment", "requires_review"]);

  if (error) throw new Error("Could not load checkout sessions for account deletion");
  const intents = (data ?? []) as StoredCheckoutIntent[];
  if (intents.length === 0) return;

  const environment = getStripeEnvironment();
  if (intents.some((intent) => intent.environment !== environment)) {
    throw new AccountDeletionManualReviewError("billing_needs_review");
  }

  const nowIso = new Date().toISOString();
  const staleCreatingIntentIds = new Set(
    intents
      .filter((intent) => intent.state === "creating" && Date.parse(intent.expires_at) <= Date.now())
      .map((intent) => intent.id),
  );
  for (const intentId of staleCreatingIntentIds) {
    // A creating intent uses a deterministic Stripe idempotency key and its
    // intended Checkout Session cannot charge after this expiry. Release it
    // only after that point so a network failure between Stripe creation and
    // local binding cannot strand account deletion forever.
    const { error: expireError } = await supabase
      .from("checkout_intents")
      .update({ state: "expired", updated_at: nowIso })
      .eq("id", intentId)
      .eq("user_id", userId)
      .eq("state", "creating")
      .lte("expires_at", nowIso);
    if (expireError) throw new Error("Could not safely expire a stale checkout before account deletion");
  }

  const unresolvedIntents = intents.filter((intent) => !staleCreatingIntentIds.has(intent.id));
  if (unresolvedIntents.some((intent) => intent.state === "awaiting_payment" || intent.state === "requires_review")) {
    // A completed or ambiguous payment must be reconciled (and, for a
    // lifetime purchase, refunded if needed) before application records are
    // cascaded away. Do not endlessly poll a webhook outcome from deletion.
    throw new AccountDeletionManualReviewError("billing_needs_review");
  }

  if (unresolvedIntents.some((intent) => intent.state === "creating")) {
    // A request may be between reserving an intent and receiving Stripe's
    // response. Deleting now could leave a charge with no account to receive
    // the entitlement, so deliberately fail closed.
    throw new AccountDeletionBlockedError(
      "A checkout is still being prepared. Please wait a moment and try again.",
      "checkout_pending",
    );
  }

  const stripe = createStripeClient(environment);
  for (const intent of unresolvedIntents) {
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
      throw new AccountDeletionManualReviewError("billing_needs_review");
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

async function collectSecureOwnedPayslipFilePaths(userId: string): Promise<string[]> {
  const filePaths: Array<string | null> = [];
  let offset = 0;

  // Validate the complete set before removing a single object. A malformed
  // legacy row must block deletion, not be skipped and then cascaded away with
  // the auth user, because that would orphan a confidential payslip object.
  while (true) {
    const { data, error } = await supabase
      .from("payslips")
      .select("file_path")
      .eq("user_id", userId)
      .order("id")
      .range(offset, offset + PAYSLIP_QUERY_PAGE_SIZE - 1);

    if (error) throw new Error("Could not load payslip files for account deletion");

    const payslips = (data ?? []) as StoredPayslip[];
    filePaths.push(...payslips.map((payslip) => payslip.file_path));

    if (payslips.length < PAYSLIP_QUERY_PAGE_SIZE) break;
    offset += payslips.length;
  }

  let paths: string[];
  try {
    // Validate database references before asking storage to do any service-role
    // work. A malformed legacy row must block deletion rather than trigger a
    // potentially large enumeration and then cascade away its only reference.
    const referencedPaths = requireSecureOwnedPayslipPathsForAccountDeletion(filePaths, userId);

    // A client can upload successfully then fail to create its DB row (for
    // example, after a transient network failure). Those private objects are
    // still confidential customer data, so account deletion must enumerate
    // the whole authenticated prefix rather than only the referenced rows.
    const storagePaths = await enumerateSecureOwnedPayslipStoragePaths(
      (prefix, options) => supabase.storage.from("payslips").list(prefix, {
        ...options,
        sortBy: { column: "name", order: "asc" },
      }),
      userId,
    );
    paths = requireSecureOwnedPayslipPathsForAccountDeletion(
      [...referencedPaths, ...storagePaths],
      userId,
    );
  } catch (error) {
    if (
      error instanceof AccountDeletionStoragePathVerificationError
      || error instanceof AccountDeletionStorageEnumerationError
    ) {
      throw new AccountDeletionBlockedError(
        "We need to safely confirm removal of a stored payslip before deleting this account. Please contact support.",
        "payslip_cleanup_needs_review",
      );
    }
    throw error;
  }

  return paths;
}

async function deleteSecureOwnedPayslipFiles(paths: string[]) {
  for (let start = 0; start < paths.length; start += STORAGE_DELETE_BATCH_SIZE) {
    const batch = paths.slice(start, start + STORAGE_DELETE_BATCH_SIZE);
    const { error: storageError } = await supabase.storage.from("payslips").remove(batch);

    if (storageError) throw new Error("Could not remove payslip files for account deletion");
  }
}

async function removeAccountRateLimitEntries(userId: string) {
  // Rate-limit records are service-only, but the exact bucket key is still
  // correlated to an account. Remove it on successful deletion rather than
  // leaving it solely to the short server-side expiry safety net.
  const { error } = await supabase
    .from("rate_limits")
    .delete()
    .in("bucket_key", [
      `process-payslip:user:${userId}`,
      `payslip-upload:user:${userId}`,
    ]);

  if (error) {
    // Do not strand an otherwise-completed account deletion after the auth
    // user and confidential payslip files are gone. The rate-limit RPC also
    // removes expired buckets; log only a non-sensitive code for follow-up.
    console.error("[delete-account] rate-limit cleanup deferred", { code: error.code ?? "unknown" });
  }
}

type AccountDeletionRunResult =
  | { kind: "deleted" }
  | { kind: "deleted_with_review"; safeCode: "billing_needs_review" }
  | { kind: "pending"; nextAttemptAt: Date; safeCode: string }
  | { kind: "manual_review"; safeCode: "billing_needs_review" | "payslip_cleanup_needs_review" | "deletion_recovery_needed" };

function retryAt(attemptCount: number) {
  const seconds = Math.min(15 * 2 ** Math.min(Math.max(attemptCount - 1, 0), 6), 15 * 60);
  return new Date(Date.now() + seconds * 1000);
}

async function beginAccountDeletionRequest(userId: string): Promise<{ jobId: string; manualReview: boolean }> {
  const { data, error } = await supabase.rpc("begin_account_deletion_request", {
    p_user_id: userId,
  });
  const result = jsonRecord(data) as AccountDeletionRequest | null;
  if (error || !result || !isUuid(result.job_id) || typeof result.status !== "string") {
    throw new Error("Could not create the durable account deletion request");
  }
  return { jobId: result.job_id, manualReview: result.status === "manual_review" };
}

async function claimAccountDeletionJob(jobId: string): Promise<AccountDeletionJobClaim> {
  const { data, error } = await supabase.rpc("claim_account_deletion_job", {
    p_job_id: jobId,
    // The worker can make a bounded set of Stripe and Storage calls. Use the
    // database's longest allowed lease so a normal slow deletion does not get
    // duplicated by the scheduler midway through those external operations.
    p_lease_seconds: 300,
  });
  const result = jsonRecord(data) as AccountDeletionJobClaim | null;
  if (error || !result || typeof result.status !== "string") {
    throw new Error("Could not claim the account deletion request");
  }
  return result;
}

async function rescheduleAccountDeletionJob(
  jobId: string,
  leaseToken: string,
  nextAttemptAt: Date,
  safeErrorCode: string,
  manualReview = false,
) {
  const { data, error } = await supabase.rpc("reschedule_account_deletion_job", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_next_attempt_at: nextAttemptAt.toISOString(),
    p_safe_error_code: safeErrorCode,
    p_manual_review: manualReview,
  });
  if (error || data !== true) throw new Error("Could not save account deletion recovery state");
}

async function completeAccountDeletionJob(jobId: string, leaseToken: string): Promise<"completed" | "review_required"> {
  const { data, error } = await supabase.rpc("complete_account_deletion_job", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
  });
  if (error) throw new Error("Could not seal the account deletion receipt");
  if (data === true) return "completed";

  // Auth deletion has already succeeded at this point. A late verified billing
  // event can deliberately reopen the retained receipt for reconciliation, so
  // never report a fully clean completion when its seal is refused.
  console.error("[delete-account] completion receipt requires reconciliation");
  return "review_required";
}

async function drainAccountDeletionPayslipProcessing(userId: string): Promise<{ status: string; retryAt: Date | null }> {
  const { data, error } = await supabase.rpc("drain_secure_account_deletion_processing", {
    p_user_id: userId,
  });
  const result = jsonRecord(data);
  if (error || !result || typeof result.status !== "string") {
    throw new Error("Could not reconcile payslip processing before account deletion");
  }
  const retryAt = typeof result.retry_at === "string" ? asFutureDate(result.retry_at) : null;
  return { status: result.status, retryAt };
}

async function renewAccountDeletionJobLease(jobId: string, leaseToken: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("renew_account_deletion_job_lease", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_lease_seconds: 300,
  });
  if (error) throw new Error("Could not renew the account deletion worker lease");
  return data === true;
}

async function assertAccountDeletionBillingReady(
  jobId: string,
  leaseToken: string,
): Promise<"ready" | "review_required" | "lease_lost"> {
  const { data, error } = await supabase.rpc("assert_account_deletion_billing_ready", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
  });
  if (error || (data !== "ready" && data !== "review_required" && data !== "lease_lost")) {
    throw new Error("Could not verify billing reconciliation before account deletion");
  }
  return data;
}

async function prepareAccountDeletionAuthRemoval(
  jobId: string,
  leaseToken: string,
): Promise<"prepared" | "review_required" | "lease_lost"> {
  const { data, error } = await supabase.rpc("prepare_account_deletion_auth_removal", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
  });
  if (error || (data !== "prepared" && data !== "review_required" && data !== "lease_lost")) {
    throw new Error("Could not prepare the final account deletion boundary");
  }
  return data;
}

async function confirmAccountDeletionAuthRemoval(
  jobId: string,
  leaseToken: string,
): Promise<"ready" | "review_required" | "lease_lost"> {
  const { data, error } = await supabase.rpc("confirm_account_deletion_auth_removal", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
  });
  if (error || (data !== "ready" && data !== "review_required" && data !== "lease_lost")) {
    throw new Error("Could not confirm the final account deletion boundary");
  }
  return data;
}

async function recordAccountDeletionAuthRemoved(
  jobId: string,
  leaseToken: string,
): Promise<"recorded" | "not_found" | "auth_still_present" | "not_prepared"> {
  const { data, error } = await supabase.rpc("record_account_deletion_auth_removed", {
    p_job_id: jobId,
    p_lease_token: leaseToken,
  });
  if (
    error
    || (data !== "recorded" && data !== "not_found" && data !== "auth_still_present" && data !== "not_prepared")
  ) {
    throw new Error("Could not record the completed Auth deletion boundary");
  }
  return data;
}

async function runAccountDeletionJob(jobId: string): Promise<AccountDeletionRunResult> {
  const claim = await claimAccountDeletionJob(jobId);
  if (claim.status === "manual_review") {
    return { kind: "manual_review", safeCode: "deletion_recovery_needed" };
  }
  if (claim.status === "completed") return { kind: "deleted" };
  if (claim.status === "leased" || claim.status === "deferred") {
    return {
      kind: "pending",
      nextAttemptAt: typeof claim.next_attempt_at === "string" && asFutureDate(claim.next_attempt_at)
        ? asFutureDate(claim.next_attempt_at)!
        : retryAt(1),
      safeCode: "account_deletion_pending",
    };
  }
  if (
    claim.status !== "claimed"
    || !isUuid(claim.job_id)
    || !isUuid(claim.user_id)
    || !isUuid(claim.lease_token)
    || typeof claim.attempt_count !== "number"
  ) {
    throw new Error("Account deletion request returned an invalid claim");
  }

  const userId = claim.user_id;
  const leaseToken = claim.lease_token;
  const attemptCount = claim.attempt_count;
  const leaseLost = (): AccountDeletionRunResult => ({
    kind: "pending",
    nextAttemptAt: new Date(Date.now() + 30_000),
    safeCode: "account_deletion_pending",
  });
  const queue = async (nextAttemptAt: Date, safeCode: string) => {
    await rescheduleAccountDeletionJob(jobId, leaseToken, nextAttemptAt, safeCode);
    return { kind: "pending" as const, nextAttemptAt, safeCode };
  };
  const requireManualReview = async (
    safeCode: "billing_needs_review" | "payslip_cleanup_needs_review" | "deletion_recovery_needed",
  ) => {
    await rescheduleAccountDeletionJob(jobId, leaseToken, new Date(), safeCode, true);
    return { kind: "manual_review" as const, safeCode };
  };

  let authDeleted = false;
  try {
    const credentialExpiry = await nextActivePayslipCredentialExpiry(userId);
    if (credentialExpiry) {
      // Give the scheduled cleanup a small buffer to remove the exact object
      // after the bearer upload credential or original-link lease is no
      // longer usable.
      return queue(new Date(credentialExpiry.getTime() + 15_000), "upload_token_pending");
    }

    // A provider request already in flight cannot be pulled back. The
    // lifecycle-aware drain waits a bounded period, then terminally records a
    // stale request without dispatching anything new.
    const processingDrain = await drainAccountDeletionPayslipProcessing(userId);
    if (processingDrain.status === "pending") {
      return queue(processingDrain.retryAt ?? new Date(Date.now() + 30_000), "payslip_processing_pending");
    }
    if (processingDrain.status !== "cleared") {
      throw new Error("Could not safely reconcile payslip processing before account deletion");
    }

    let payslipPaths: string[];
    try {
      payslipPaths = await collectSecureOwnedPayslipFilePaths(userId);
    } catch (error) {
      if (error instanceof AccountDeletionBlockedError) {
        return requireManualReview("payslip_cleanup_needs_review");
      }
      throw error;
    }

    try {
      if (!await renewAccountDeletionJobLease(jobId, leaseToken)) return leaseLost();
      await expireOpenCheckoutSessionsBeforeDeletion(userId);
    } catch (error) {
      if (error instanceof AccountDeletionManualReviewError) {
        return requireManualReview(error.code);
      }
      if (error instanceof AccountDeletionBlockedError) {
        return queue(new Date(Date.now() + 30_000), error.code);
      }
      throw error;
    }

    try {
      if (!await renewAccountDeletionJobLease(jobId, leaseToken)) return leaseLost();
      await cancelVerifiedStripeSubscriptions(userId);
    } catch (error) {
      if (error instanceof AccountDeletionManualReviewError) {
        return requireManualReview(error.code);
      }
      throw error;
    }

    if (!await renewAccountDeletionJobLease(jobId, leaseToken)) return leaseLost();
    await deleteSecureOwnedPayslipFiles(payslipPaths);

    // Auth deletion is last. Recheck the non-cascading billing ledger and
    // persist a lease-bound preparation receipt at the final database
    // boundary. A webhook can still arrive after this commits, but it will
    // retain its own durable review rather than grant an entitlement after the
    // account has been removed.
    if (!await renewAccountDeletionJobLease(jobId, leaseToken)) return leaseLost();
    const billingReadiness = await assertAccountDeletionBillingReady(jobId, leaseToken);
    if (billingReadiness === "review_required") return requireManualReview("billing_needs_review");
    if (billingReadiness === "lease_lost") return leaseLost();

    const authRemovalPreparation = await prepareAccountDeletionAuthRemoval(jobId, leaseToken);
    if (authRemovalPreparation === "review_required") return requireManualReview("billing_needs_review");
    if (authRemovalPreparation === "lease_lost") return leaseLost();

    // Revalidate immediately before calling Auth. This catches an expired
    // worker lease or reconciliation that landed while this invocation was
    // delayed after preparation; after the confirmation commits, the user's
    // requested deletion has crossed its final external boundary.
    const authRemovalConfirmation = await confirmAccountDeletionAuthRemoval(jobId, leaseToken);
    if (authRemovalConfirmation === "review_required") return requireManualReview("billing_needs_review");
    if (authRemovalConfirmation === "lease_lost") return leaseLost();

    // Auth deletion cascades application records and the active lifecycle
    // fence but intentionally leaves the non-cascading job receipt.
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteUserError) throw new Error("Could not delete account");
    authDeleted = true;

    // A webhook may have intentionally cleared the active lease in the tiny
    // interval around Auth's external call. The preparation token lets the
    // durable receipt distinguish that case from an unknown out-of-band Auth
    // deletion, without overriding a billing manual-review state.
    if (await recordAccountDeletionAuthRemoved(jobId, leaseToken) !== "recorded") {
      throw new Error("Could not record the Auth deletion receipt");
    }

    await removeAccountRateLimitEntries(userId);
    if (await completeAccountDeletionJob(jobId, leaseToken) === "review_required") {
      return { kind: "deleted_with_review", safeCode: "billing_needs_review" };
    }
    return { kind: "deleted" };
  } catch (error) {
    if (authDeleted) {
      console.error("[delete-account] post-auth deletion reconciliation required", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return { kind: "deleted_with_review", safeCode: "billing_needs_review" };
    }
    if (attemptCount >= 8) return requireManualReview("deletion_recovery_needed");
    return queue(retryAt(attemptCount), "deletion_retry_pending");
  }
}

function accountDeletionResultResponse(result: AccountDeletionRunResult) {
  if (result.kind === "deleted") return jsonResponse({ success: true });
  if (result.kind === "deleted_with_review") {
    return jsonResponse({
      success: true,
      billingReviewRequired: true,
      code: result.safeCode,
      error: "Your account data has been removed. A recent payment needs a manual follow-up; please contact support.",
    }, 202);
  }
  if (result.kind === "manual_review") {
    const message = result.safeCode === "billing_needs_review"
      ? "A billing record needs a manual review before this account can be deleted. Please contact support."
      : result.safeCode === "payslip_cleanup_needs_review"
        ? "We need to safely confirm removal of a stored payslip before deleting this account. Please contact support."
        : "We could not safely complete account deletion automatically. Please contact support.";
    return jsonResponse({ error: message, code: result.safeCode }, 409);
  }
  return jsonResponse({
    pending: true,
    code: "account_deletion_pending",
    error: "Your account deletion is safely queued and will continue automatically. You can close the app while it finishes.",
    nextAttemptAt: result.nextAttemptAt.toISOString(),
  }, 202);
}

async function runDueAccountDeletionJobs(limit: number) {
  const { data, error } = await supabase
    .from("account_deletion_jobs")
    .select("id")
    .in("state", ["queued", "running"])
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error("Could not load pending account deletion requests");

  const results: Record<string, number> = {
    deleted: 0,
    deleted_with_review: 0,
    pending: 0,
    manual_review: 0,
    failed: 0,
  };
  for (const row of data ?? []) {
    const jobId = isRecord(row) && isUuid(row.id) ? row.id : null;
    if (!jobId) continue;
    try {
      const result = await runAccountDeletionJob(jobId);
      results[result.kind] += 1;
    } catch {
      results.failed += 1;
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const workerSecret = Deno.env.get("ACCOUNT_DELETION_WORKER_SECRET");
    const isWorker = workerSecret
      ? await secretsMatch(workerSecret, req.headers.get("x-account-deletion-worker-secret"))
      : false;

    if (isWorker) {
      let payload: unknown = null;
      try {
        payload = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid worker request" }, 400);
      }
      if (!isRecord(payload) || payload.runDue !== true) {
        return jsonResponse({ error: "Invalid worker request" }, 400);
      }
      const requestedLimit = typeof payload.limit === "number" && Number.isInteger(payload.limit)
        ? payload.limit
        : 10;
      const limit = Math.max(1, Math.min(requestedLimit, 25));
      const results = await runDueAccountDeletionJobs(limit);
      return jsonResponse({ success: true, results });
    }

    const accessToken = getBearerToken(req);
    if (!accessToken) return jsonResponse({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const request = await beginAccountDeletionRequest(user.id);
    if (request.manualReview) {
      return accountDeletionResultResponse({ kind: "manual_review", safeCode: "deletion_recovery_needed" });
    }
    return accountDeletionResultResponse(await runAccountDeletionJob(request.jobId));
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
