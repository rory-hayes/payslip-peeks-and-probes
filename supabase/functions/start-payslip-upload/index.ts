import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import {
  bodyAsJson,
  getBearerToken,
  isOwnedPayslipObjectPath,
  isRecord,
  isUuid,
  jsonResponse,
  PAYSLIP_CORS_HEADERS,
  parseUploadMetadata,
  PAYSLIP_BUCKET,
} from "../_shared/payslip-upload.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type BeginSessionResult = {
  status: string;
  session_id?: unknown;
  object_path?: unknown;
  expires_at?: unknown;
  tier?: unknown;
  quota_limit?: unknown;
  quota_scope?: unknown;
  monthly_limit?: unknown;
};

async function clearExpiredSessionsForUser(userId: string) {
  const { data, error } = await supabase.rpc("list_expired_secure_payslip_upload_sessions", {
    p_user_id: userId,
    p_limit: 2,
  });
  if (error || !Array.isArray(data)) return false;

  for (const entry of data) {
    if (!isRecord(entry) || !isUuid(entry.session_id) || !isOwnedPayslipObjectPath(entry.object_path, userId)) {
      return false;
    }

    const { error: removeError } = await supabase.storage
      .from(PAYSLIP_BUCKET)
      .remove([entry.object_path]);
    if (removeError) return false;

    const { data: settled, error: settleError } = await supabase.rpc("settle_expired_secure_payslip_upload_session", {
      p_session_id: entry.session_id,
      p_user_id: userId,
    });
    if (settleError || settled !== true) return false;
  }

  return true;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: PAYSLIP_CORS_HEADERS });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const accessToken = getBearerToken(request);
  if (!accessToken) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user || !isUuid(user.id)) return jsonResponse({ error: "Unauthorized" }, 401);

    const metadata = parseUploadMetadata(await bodyAsJson(request));
    if (!metadata) {
      return jsonResponse({ error: "Choose a PDF, PNG, JPG, or WebP payslip under 10 MB." }, 400);
    }

    // Issuance is a storage-cost control, independent of the later provider
    // limit. It intentionally fails closed if its durable rate-limit record is
    // unavailable.
    const rateLimit = await checkRateLimit({
      bucketKey: `payslip-upload:user:${user.id}`,
      maxPerWindow: 12,
      windowSeconds: 60 * 60,
      client: supabase,
    });
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: "Too many upload attempts. Please wait a little and try again." },
        429,
      );
    }

    // The session lasts slightly longer than Supabase's documented two-hour
    // signed-upload token so cleanup never releases a quota slot early.
    if (!await clearExpiredSessionsForUser(user.id)) {
      return jsonResponse({ error: "We could not safely clear an unfinished upload. Please try again shortly." }, 503);
    }

    const environment = Deno.env.get("PAYCHECK_STRIPE_ENV");
    if (environment !== "sandbox" && environment !== "live") {
      return jsonResponse({ error: "Payslip uploads are not configured yet. Please try again later." }, 503);
    }

    const { data, error } = await supabase.rpc("begin_secure_payslip_upload_session", {
      p_user_id: user.id,
      p_environment: environment,
      p_display_file_name: metadata.displayFileName,
    });
    const session = isRecord(data) ? data as BeginSessionResult : null;
    const status = session?.status;

    if (error || !session || typeof status !== "string") {
      console.error("[start-payslip-upload] session reservation failed", { code: error?.code ?? "invalid_response" });
      return jsonResponse({ error: "We could not prepare a secure upload. Please try again." }, 503);
    }
    if (status === "cleanup_required") {
      // A concurrent request may have crossed the expiry boundary after the
      // pre-cleanup. Keep the reservation until a later server cleanup pass.
      return jsonResponse({ error: "We are safely clearing an unfinished upload. Please try again shortly." }, 409);
    }
    if (status === "active_upload_limit") {
      return jsonResponse({ error: "Finish or wait for one of your existing uploads before starting another." }, 429);
    }
    if (status === "account_deletion_pending") {
      return jsonResponse({ error: "Your account deletion is being safely completed, so new uploads are unavailable." }, 409);
    }
    if (status === "quota_exceeded") {
      const tier = session.tier === "plus" || session.tier === "lifetime" ? session.tier : "free";
      const limit = typeof session.quota_limit === "number"
        ? session.quota_limit
        : typeof session.monthly_limit === "number"
          ? session.monthly_limit
          : null;
      const scope = session.quota_scope === "lifetime" ? "lifetime" : "month";
      const paidTier = tier === "plus" || tier === "lifetime";
      const error = !paidTier && scope === "lifetime"
        ? `You've used the ${limit ?? 2} automatic checks included with Free. Upgrade to continue automatic checks each payday.`
        : `Your ${limit ? `${limit} ` : ""}automatic-check limit for this calendar month has been reached.`;
      return jsonResponse({ error, code: "automatic_check_limit_reached" }, paidTier ? 429 : 402);
    }
    if (
      status !== "issued"
      || !isUuid(session.session_id)
      || !isOwnedPayslipObjectPath(session.object_path, user.id)
      || typeof session.expires_at !== "string"
    ) {
      console.error("[start-payslip-upload] invalid session response");
      return jsonResponse({ error: "We could not prepare a secure upload. Please try again." }, 503);
    }

    const { data: signedUpload, error: signedUploadError } = await supabase.storage
      .from(PAYSLIP_BUCKET)
      .createSignedUploadUrl(session.object_path, { upsert: false });

    if (signedUploadError || !signedUpload?.token || signedUpload.path !== session.object_path) {
      // No client has a token in this branch. A later cleanup pass will only
      // release the reservation after confirming the path has no object.
      console.error("[start-payslip-upload] signed upload creation failed", { code: signedUploadError?.name ?? "unknown" });
      return jsonResponse({ error: "We could not prepare a secure upload. Please try again." }, 503);
    }

    return jsonResponse({
      sessionId: session.session_id,
      path: session.object_path,
      token: signedUpload.token,
      contentType: metadata.contentType,
      expiresAt: session.expires_at,
    });
  } catch (error) {
    console.error("[start-payslip-upload] failed", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse({ error: "We could not prepare a secure upload. Please try again." }, 500);
  }
});
