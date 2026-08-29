// Release deployment sync: keep this reviewed function aligned with the repository revision.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createStripeClient,
  getAppOrigin,
  getPriceCatalogEntry,
  getStripeEnvironment,
} from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface StoredSubscriptionCandidate {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  price_id: string | null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

function isCurrentStripeSubscription(status: string, currentPeriodEnd: number | null) {
  if (["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(status)) {
    return true;
  }
  return status === "canceled"
    && typeof currentPeriodEnd === "number"
    && currentPeriodEnd * 1000 > Date.now();
}

async function verifiedCustomerId(
  candidate: StoredSubscriptionCandidate,
  userId: string,
  stripe: ReturnType<typeof createStripeClient>,
) {
  if (!candidate.stripe_customer_id || !candidate.stripe_subscription_id.startsWith("sub_")) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(candidate.stripe_subscription_id, {
      expand: ["items.data.price"],
    });
    const price = subscription.items.data[0]?.price;
    const priceLookupKey = typeof price === "string" ? null : price?.lookup_key ?? null;
    const catalogEntry = getPriceCatalogEntry(priceLookupKey);
    const remoteCustomerId = typeof subscription.customer === "string" ? subscription.customer : null;

    if (
      !remoteCustomerId
      || remoteCustomerId !== candidate.stripe_customer_id
      || subscription.metadata?.userId !== userId
      || catalogEntry?.mode !== "subscription"
      || (candidate.price_id !== null && priceLookupKey !== candidate.price_id)
      || !isCurrentStripeSubscription(subscription.status, subscription.current_period_end)
    ) {
      return null;
    }

    return remoteCustomerId;
  } catch {
    // A stale historic row must not cause the portal to open for an arbitrary
    // Stripe customer. Other verified candidates may still be usable.
    return null;
  }
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

    const { data: lifecycleActive, error: lifecycleError } = await supabase.rpc("is_account_lifecycle_active", {
      p_user_id: user.id,
    });
    if (lifecycleError || lifecycleActive !== true) {
      return jsonResponse({
        code: "account_deletion_pending",
        error: "Your account deletion is being safely completed, so billing changes are unavailable.",
      }, 409);
    }

    const environment = getStripeEnvironment();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, price_id")
      .eq("user_id", user.id)
      .eq("environment", environment);
    if (error) throw new Error("Could not load subscription");

    const stripe = createStripeClient(environment);
    const customerIds = new Set<string>();
    for (const candidate of (data ?? []) as StoredSubscriptionCandidate[]) {
      const customerId = await verifiedCustomerId(candidate, user.id, stripe);
      if (customerId) customerIds.add(customerId);
    }

    if (customerIds.size === 0) {
      // Existing browser entitlement logic still reads this table. Its stored
      // customer/subscription pair is only accepted after the same remote
      // ownership and catalogue checks used for the current table.
      const { data: legacy, error: legacyError } = await supabase
        .from("billing_subscriptions")
        .select("stripe_customer_id, stripe_subscription_id, plan, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (legacyError) throw new Error("Could not load legacy subscription");

      if (
        legacy?.plan === "plus"
        && (legacy.status === "active" || legacy.status === "past_due")
        && legacy.stripe_customer_id
        && legacy.stripe_subscription_id
      ) {
        const customerId = await verifiedCustomerId({
          stripe_customer_id: legacy.stripe_customer_id,
          stripe_subscription_id: legacy.stripe_subscription_id,
          // The remote subscription's configured catalogue is authoritative;
          // this only selects the legacy candidate for verification.
          price_id: null,
        }, user.id, stripe);
        if (customerId) customerIds.add(customerId);
      }
    }

    if (customerIds.size === 0) {
      return jsonResponse({ error: "No current subscription found" }, 404);
    }
    if (customerIds.size > 1) {
      return jsonResponse({
        code: "billing_contact_support",
        error: "We found more than one billing record. Please contact support before making changes.",
      }, 409);
    }

    const [customer] = customerIds;
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: new URL("/settings", getAppOrigin().origin).toString(),
    });

    return jsonResponse({ url: portal.url });
  } catch (error) {
    console.error("[create-portal-session] failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse({ error: "Unable to open the billing portal. Please try again." }, 500);
  }
});
