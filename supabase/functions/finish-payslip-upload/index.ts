// Release deployment sync: keep this reviewed function aligned with the repository revision.
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { detectPayslipMimeType } from "../_shared/payslip-file-validation.ts";
import {
  bodyAsJson,
  getBearerToken,
  isRecord,
  isOwnedPayslipObjectPath,
  isUuid,
  jsonResponse,
  PAYSLIP_BUCKET,
  PAYSLIP_CORS_HEADERS,
  PAYSLIP_MAX_FILE_BYTES,
} from "../_shared/payslip-upload.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function sessionIdFromBody(value: unknown): string | null {
  return isRecord(value) && isUuid(value.sessionId) ? value.sessionId : null;
}

async function requestSessionCleanup(userId: string, sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("request_payslip_upload_session_cleanup", {
    p_session_id: sessionId,
    p_user_id: userId,
  });
  return !error && isRecord(data) && data.status === "pending";
}

async function removeAndExpireSession(userId: string, sessionId: string): Promise<boolean> {
  const { data: session, error: sessionError } = await supabase
    .from("payslip_upload_sessions")
    .select("object_path")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError || !session?.object_path) return false;

  const { error: removeError } = await supabase.storage
    .from(PAYSLIP_BUCKET)
    .remove([session.object_path]);
  if (removeError) return false;

  const { data: expired, error: expireError } = await supabase.rpc("settle_expired_secure_payslip_upload_session", {
    p_session_id: sessionId,
    p_user_id: userId,
  });
  return !expireError && expired === true;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: PAYSLIP_CORS_HEADERS });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const accessToken = getBearerToken(request);
  if (!accessToken) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user || !isUuid(user.id)) return jsonResponse({ error: "Unauthorized" }, 401);

    const sessionId = sessionIdFromBody(await bodyAsJson(request));
    if (!sessionId) return jsonResponse({ error: "A valid upload session is required." }, 400);

    const { data: session, error: sessionError } = await supabase
      .from("payslip_upload_sessions")
      .select("state, expires_at, object_path, payslip_id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (sessionError || !session) return jsonResponse({ error: "This upload is no longer available. Please start again." }, 404);

    if (session.state === "finalized") {
      if (!isUuid(session.payslip_id)) {
        return jsonResponse({ error: "We could not resume that upload. Refresh and try again." }, 409);
      }
      return jsonResponse({ payslipId: session.payslip_id, resumed: true });
    }

    if (session.state !== "issued") {
      return jsonResponse({ error: "This upload is no longer available. Please start again." }, 409);
    }
    if (!isOwnedPayslipObjectPath(session.object_path, user.id)) {
      return jsonResponse({ error: "We could not safely find that upload. Please start again." }, 409);
    }

    if (Date.parse(session.expires_at) <= Date.now()) {
      await removeAndExpireSession(user.id, sessionId);
      return jsonResponse({ error: "That secure upload link expired. Please start again." }, 410);
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(PAYSLIP_BUCKET)
      .download(session.object_path);
    if (downloadError || !file) {
      return jsonResponse({ error: "We could not find that uploaded payslip. Please start again." }, 409);
    }
    if (file.size < 1 || file.size > PAYSLIP_MAX_FILE_BYTES) {
      await requestSessionCleanup(user.id, sessionId);
      return jsonResponse({ error: "Choose a PDF or image under 10 MB. This private upload will be cleared automatically after its short security window." }, 422);
    }

    let fileBytes: ArrayBuffer;
    try {
      fileBytes = await file.arrayBuffer();
    } catch {
      return jsonResponse({ error: "We could not read that upload. Please try again." }, 503);
    }
    const detectedMimeType = detectPayslipMimeType(new Uint8Array(fileBytes));
    if (!detectedMimeType) {
      await requestSessionCleanup(user.id, sessionId);
      return jsonResponse({ error: "Choose a PDF, PNG, JPG, or WebP payslip. This private upload will be cleared automatically after its short security window." }, 422);
    }

    const { data, error } = await supabase.rpc("finalize_secure_payslip_upload_session", {
      p_session_id: sessionId,
      p_user_id: user.id,
      p_actual_bytes: file.size,
      p_detected_mime_type: detectedMimeType,
    });
    const result = isRecord(data) ? data : null;
    const status = result?.status;
    if (error || !result || typeof status !== "string") {
      console.error("[finish-payslip-upload] finalisation failed", { code: error?.code ?? "invalid_response" });
      return jsonResponse({ error: "We could not save that payslip. Please try again." }, 503);
    }
    if (status === "expired") {
      await removeAndExpireSession(user.id, sessionId);
      return jsonResponse({ error: "That secure upload link expired. Please start again." }, 410);
    }
    if (status === "missing_object") {
      return jsonResponse({ error: "We could not find that uploaded payslip. Please start again." }, 409);
    }
    if (status === "account_deletion_pending") {
      return jsonResponse({ error: "Your account deletion is being safely completed, so this upload will not be saved." }, 409);
    }
    if (status !== "finalized" || !isUuid(result.payslip_id)) {
      return jsonResponse({ error: "We could not save that payslip. Please try again." }, 409);
    }

    return jsonResponse({ payslipId: result.payslip_id, resumed: false });
  } catch (error) {
    console.error("[finish-payslip-upload] failed", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse({ error: "We could not save that payslip. Please try again." }, 500);
  }
});
