import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Kept only to give an explicit response to any older clients. The prior
// endpoint cancelled rows based on a partial local view of billing state. New
// clients use the remotely-verified billing portal or the guarded
// delete-account flow, which cancels every verified current subscription
// before deleting data.
serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return jsonResponse({
    code: "endpoint_retired",
    error: "This billing endpoint has been retired. Manage billing from Settings or delete your account there.",
  }, 410);
});
