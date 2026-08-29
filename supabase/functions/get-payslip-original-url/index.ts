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
  PAYSLIP_SIGNED_URL_TTL_SECONDS,
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

    const { data: payslip, error: payslipError } = await supabase
      .from("payslips")
      .select("file_path")
      .eq("id", payslipId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (payslipError || !payslip || !isOwnedPayslipObjectPath(payslip.file_path, user.id)) {
      return jsonResponse({ error: "The saved original is unavailable." }, 404);
    }

    // A failed-upload removal request fences the document until the signed
    // upload token has expired and server cleanup can erase it. Do not mint a
    // fresh bearer read link after the owner has asked for removal.
    const { data: session, error: sessionError } = await supabase
      .from("payslip_upload_sessions")
      .select("state")
      .eq("payslip_id", payslipId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (sessionError) {
      return jsonResponse({ error: "The saved original is unavailable." }, 503);
    }
    if (session?.state === "cleanup_pending") {
      return jsonResponse({ error: "The saved original is being securely removed." }, 409);
    }

    // Persist the bounded read lease before asking Storage to mint the bearer
    // URL. The database transaction shares the deletion lifecycle lock, so a
    // deletion that wins first rejects this request; a link that wins first is
    // safely waited out before Storage/Auth cleanup begins.
    const { data: leaseData, error: leaseError } = await supabase.rpc(
      "reserve_secure_payslip_original_link_lease",
      {
        p_user_id: user.id,
        p_payslip_id: payslipId,
        p_object_path: payslip.file_path,
        p_lease_seconds: PAYSLIP_SIGNED_URL_TTL_SECONDS * 2,
      },
    );
    const lease = isRecord(leaseData) ? leaseData : null;
    const leaseId = lease && isUuid(lease.lease_id) ? lease.lease_id : null;
    const initialLeaseExpiresAt = lease && typeof lease.expires_at === "string"
      ? Date.parse(lease.expires_at)
      : Number.NaN;
    if (leaseError || !lease || typeof lease.status !== "string") {
      return jsonResponse({ error: "We could not prepare the saved original. Please try again." }, 503);
    }
    if (lease.status === "account_deletion_pending") {
      return jsonResponse({ error: "Your account deletion is being safely completed, so saved originals are unavailable." }, 409);
    }
    if (lease.status === "cleanup_pending") {
      return jsonResponse({ error: "The saved original is being securely removed." }, 409);
    }
    if (lease.status !== "issued") {
      return jsonResponse({ error: "The saved original is unavailable." }, 404);
    }

    // The initial reservation is deliberately longer than the browser URL.
    // It remains private: if Storage is slow, the response can be discarded
    // instead of returning a URL that might outlive the deletion fence.
    if (
      !leaseId
      || !Number.isFinite(initialLeaseExpiresAt)
      || initialLeaseExpiresAt <= Date.now() + PAYSLIP_SIGNED_URL_TTL_SECONDS * 1000 + 15_000
    ) {
      return jsonResponse({ error: "We could not prepare the saved original. Please try again." }, 503);
    }

    const signedUrlRequestStartedAt = Date.now();
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from(PAYSLIP_BUCKET)
      .createSignedUrl(payslip.file_path, PAYSLIP_SIGNED_URL_TTL_SECONDS);
    if (signedUrlError || !signedUrl?.signedUrl) {
      return jsonResponse({ error: "We could not prepare the saved original. Please try again." }, 503);
    }

    // Treat the URL as expiring from the start of the Storage request. This
    // conservative value is never later than the real Storage expiry, so a
    // caller cannot receive a link after its safe window is almost gone.
    const conservativeUrlExpiresAt = signedUrlRequestStartedAt
      + PAYSLIP_SIGNED_URL_TTL_SECONDS * 1000;
    if (conservativeUrlExpiresAt <= Date.now() + 15_000) {
      return jsonResponse({ error: "We could not prepare the saved original. Please try again." }, 503);
    }

    // Activate/extend the exact lease only after Storage has produced an
    // undisclosed URL and immediately before sending it to the caller. If
    // deletion began in this gap, this second lifecycle-locked RPC declines
    // the response and the URL is never exposed.
    const { data: activeLeaseData, error: activeLeaseError } = await supabase.rpc(
      "activate_secure_payslip_original_link_lease",
      {
        p_lease_id: leaseId,
        p_user_id: user.id,
        p_payslip_id: payslipId,
        p_object_path: payslip.file_path,
        p_lease_seconds: PAYSLIP_SIGNED_URL_TTL_SECONDS + 15,
      },
    );
    const activeLease = isRecord(activeLeaseData) ? activeLeaseData : null;
    if (activeLeaseError || !activeLease || activeLease.status !== "issued") {
      if (activeLease?.status === "cleanup_pending") {
        return jsonResponse({ error: "The saved original is being securely removed." }, 409);
      }
      return jsonResponse({ error: "The saved original is unavailable." }, 409);
    }
    if (conservativeUrlExpiresAt <= Date.now() + 5_000) {
      return jsonResponse({ error: "We could not prepare the saved original. Please try again." }, 503);
    }

    return jsonResponse({
      url: signedUrl.signedUrl,
      expiresAt: new Date(conservativeUrlExpiresAt).toISOString(),
    });
  } catch (error) {
    console.error("[get-payslip-original-url] failed", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse({ error: "We could not prepare the saved original. Please try again." }, 500);
  }
});
