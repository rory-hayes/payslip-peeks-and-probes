// Release deployment sync: keep this reviewed function aligned with the repository revision.
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  bodyAsJson,
  getBearerToken,
  isOwnedPayslipObjectPath,
  isRecord,
  isUuid,
  jsonResponse,
  PAYSLIP_BUCKET,
  PAYSLIP_CORS_HEADERS,
} from "../_shared/payslip-upload.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: PAYSLIP_CORS_HEADERS });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const accessToken = getBearerToken(request);
  if (!accessToken) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user || !isUuid(user.id)) return jsonResponse({ error: "Unauthorized" }, 401);

    const payload = await bodyAsJson(request);
    const payslipId = isRecord(payload) && isUuid(payload.payslipId) ? payload.payslipId : null;
    if (!payslipId) return jsonResponse({ error: "A valid payslip is required." }, 400);

    // Claim the failed row before touching Storage. The database claim fences a
    // concurrent retry, and can defer removal while a non-revocable signed
    // upload token is still valid for this exact object path.
    const { data: requestedData, error: requestError } = await supabase.rpc("request_failed_payslip_cleanup", {
      p_payslip_id: payslipId,
      p_user_id: user.id,
    });
    const requestResult = isRecord(requestedData) ? requestedData : null;
    const requestStatus = requestResult?.status;
    if (requestError || !requestResult || typeof requestStatus !== "string") {
      console.error("[delete-failed-payslip] cleanup claim failed", { code: requestError?.code ?? "invalid_response" });
      return jsonResponse({ error: "We could not safely prepare that upload for removal. Please try again." }, 503);
    }
    if (requestStatus === "not_found") return jsonResponse({ success: true, alreadyRemoved: true });
    if (requestStatus === "not_removable") {
      return jsonResponse({ error: "Only an unfinished automatic check can be removed." }, 409);
    }
    if (requestStatus === "needs_review") {
      return jsonResponse({ error: "We could not safely remove that saved file. Please contact support." }, 409);
    }
    if (requestStatus === "waiting_for_token_expiry") {
      return jsonResponse({
        success: true,
        pending: true,
        expiresAt: typeof requestResult.expires_at === "string" ? requestResult.expires_at : null,
      }, 202);
    }
    if (requestStatus !== "ready") {
      return jsonResponse({ error: "We could not safely remove that upload. Please try again." }, 409);
    }

    const objectPath = requestResult.object_path;
    if (objectPath !== null && objectPath !== undefined && !isOwnedPayslipObjectPath(objectPath, user.id)) {
      return jsonResponse({ error: "We could not safely remove that saved file. Please contact support." }, 409);
    }

    if (typeof objectPath === "string") {
      const { error: removeError } = await supabase.storage
        .from(PAYSLIP_BUCKET)
        .remove([objectPath]);
      if (removeError) {
        return jsonResponse({ error: "We could not remove the saved file, so its record has been kept. Please try again." }, 503);
      }
    }

    const { data, error } = await supabase.rpc("delete_failed_payslip_after_storage_cleanup", {
      p_payslip_id: payslipId,
      p_user_id: user.id,
    });
    const result = isRecord(data) ? data : null;
    if (error || !result || typeof result.status !== "string") {
      console.error("[delete-failed-payslip] database cleanup failed", { code: error?.code ?? "invalid_response" });
      return jsonResponse({ error: "The saved file was removed, but we could not finish removing its record. Try again." }, 503);
    }
    if (result.status === "object_present") {
      return jsonResponse({ error: "We could not safely confirm removal of the saved file. Please try again." }, 503);
    }
    if (result.status === "token_active") {
      // A defensive backstop for an unexpected service-side race. Keep the
      // database recovery handle until the non-revocable upload token expires;
      // the scheduled cleanup job will make a later removal attempt.
      return jsonResponse({
        success: true,
        pending: true,
        expiresAt: typeof result.expires_at === "string" ? result.expires_at : null,
      }, 202);
    }
    if (result.status !== "deleted" && result.status !== "not_found") {
      return jsonResponse({ error: "We could not finish removing that upload. Please try again." }, 503);
    }

    return jsonResponse({ success: true, alreadyRemoved: result.status === "not_found" });
  } catch (error) {
    console.error("[delete-failed-payslip] failed", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse({ error: "We could not remove that upload. Please try again." }, 500);
  }
});
