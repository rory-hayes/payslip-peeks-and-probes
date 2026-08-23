import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  createStripeClient,
  getPriceCatalogEntry,
  getStripeEnvironment,
  matchesCatalogStripePrice,
} from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: responseHeaders,
    });
  }

  try {
    const accessToken = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: responseHeaders,
      });
    }

    const { priceId } = await req.json();
    const catalogEntry = getPriceCatalogEntry(priceId);
    if (!catalogEntry || typeof priceId !== "string") {
      return new Response(JSON.stringify({ error: "That plan is not available." }), {
        status: 400,
        headers: responseHeaders,
      });
    }

    const stripe = createStripeClient(getStripeEnvironment());
    const prices = await stripe.prices.list({ lookup_keys: [priceId], active: true, limit: 1 });
    const price = prices.data[0];
    if (!matchesCatalogStripePrice(price, priceId)) {
      return new Response(JSON.stringify({ error: "That plan is not currently available." }), {
        status: 503,
        headers: responseHeaders,
      });
    }

    return new Response(JSON.stringify({ stripeId: price.id }), {
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[get-stripe-price] failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response(JSON.stringify({ error: "Unable to resolve that plan." }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
