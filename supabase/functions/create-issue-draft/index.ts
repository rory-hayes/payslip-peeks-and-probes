import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getStripeEnvironment } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type Draft = { id: string; subject: string | null; body: string | null };

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && (typeof record.subject === "string" || record.subject === null)
    && (typeof record.body === "string" || record.body === null);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const accessToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request" }, 400);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    const record = payload as Record<string, unknown>;
    if (
      typeof record.payslipId !== "string"
      || typeof record.subject !== "string"
      || typeof record.body !== "string"
    ) {
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    const environment = getStripeEnvironment();
    const { data, error } = await supabase.rpc("create_issue_draft", {
      p_user_id: user.id,
      p_payslip_id: record.payslipId,
      p_subject: record.subject,
      p_body: record.body,
      p_environment: environment,
    });

    if (error) {
      if (error.code === "P0001" && error.message === "Draft limit reached") {
        return jsonResponse({ code: "draft_limit_reached" });
      }
      throw new Error("Could not create draft");
    }

    const draft = Array.isArray(data) ? data[0] : data;
    if (!isDraft(draft)) throw new Error("Draft creation returned an invalid result");
    return jsonResponse({ draft });
  } catch (error) {
    console.error("[create-issue-draft] failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonResponse({ error: "Unable to save draft. Please try again." }, 500);
  }
});
