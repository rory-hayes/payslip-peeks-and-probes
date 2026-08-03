import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  createStripeClient,
  getPriceCatalogEntry,
  getStripeEnvironment,
} from "../_shared/stripe.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { priceId } = await req.json();
    const catalogEntry = getPriceCatalogEntry(priceId);
    if (!catalogEntry || typeof priceId !== "string") {
      return new Response(JSON.stringify({ error: "That plan is not available." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(getStripeEnvironment());
    const prices = await stripe.prices.list({ lookup_keys: [priceId], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price || price.lookup_key !== priceId || price.type !== catalogEntry.mode) {
      return new Response(JSON.stringify({ error: "That plan is not currently available." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ stripeId: price.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[get-stripe-price] failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response(JSON.stringify({ error: "Unable to resolve that plan." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
