import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getStripeEnvironment, type StripeEnv } from "../_shared/stripe.ts";

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
  | "account_deletion_pending"
  | "refunded";

type CheckoutReturnStatus = "confirmed" | "pending" | "invalid" | "review";

interface StoredCheckoutIntent {
  environment: StripeEnv;
  state: CheckoutIntentState;
  stripe_checkout_session_id: string;
}

const CHECKOUT_SESSION_ID_PATTERN = /^cs_(?:test_|live_)?[A-Za-z0-9_]{8,250}$/;
const CHECKOUT_INTENT_STATES = new Set<CheckoutIntentState>([
  "creating",
  "open",
  "awaiting_payment",
  "succeeded",
  "expired",
  "failed",
  "requires_review",
  "account_deletion_pending",
  "refunded",
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStoredCheckoutIntent(value: unknown): value is StoredCheckoutIntent {
  if (!isRecord(value)) return false;

  return (value.environment === "sandbox" || value.environment === "live")
    && typeof value.stripe_checkout_session_id === "string"
    && typeof value.state === "string"
    && CHECKOUT_INTENT_STATES.has(value.state as CheckoutIntentState);
}

/**
 * `succeeded` is server-written only after the webhook has verified the exact
 * app-bound Stripe Checkout Session and persisted its entitlement. This
 * endpoint never grants access; it only reports the exact return session's
 * durable state to its authenticated owner.
 */
function statusForIntentState(state: CheckoutIntentState): CheckoutReturnStatus {
  if (state === "succeeded") return "confirmed";
  if (state === "creating" || state === "open" || state === "awaiting_payment") return "pending";
  if (state === "requires_review" || state === "account_deletion_pending") return "review";
  return "invalid";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const accessToken = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request" }, 400);
    }
    const environment = getStripeEnvironment();
    const sessionId = isRecord(body) ? body.sessionId : null;
    if (typeof sessionId !== "string" || !CHECKOUT_SESSION_ID_PATTERN.test(sessionId)) {
      // This remains a normal state response so the return page can explain a
      // bad or expired link without exposing whether any session exists.
      return jsonResponse({ environment, status: "invalid" });
    }

    const { data: lifecycleActive, error: lifecycleError } = await supabase.rpc("is_account_lifecycle_active", {
      p_user_id: user.id,
    });
    if (lifecycleError || lifecycleActive !== true) {
      return jsonResponse({ environment, status: "review" });
    }

    const { data, error } = await supabase
      .from("checkout_intents")
      .select("environment, state, stripe_checkout_session_id")
      .eq("user_id", user.id)
      .eq("environment", environment)
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (error) throw new Error("Could not load the checkout return state");
    if (!data) return jsonResponse({ environment, status: "invalid" });
    if (!isStoredCheckoutIntent(data) || data.environment !== environment || data.stripe_checkout_session_id !== sessionId) {
      console.error("[verify-checkout-return] checkout return record did not match its exact session", { environment });
      return jsonResponse({ environment, status: "review" });
    }

    return jsonResponse({ environment, status: statusForIntentState(data.state) });
  } catch (error) {
    console.error("[verify-checkout-return] failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse({ error: "Unable to confirm this checkout yet. Please try again shortly." }, 500);
  }
});
