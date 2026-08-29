// Release deployment sync: keep this reviewed function aligned with the repository revision.
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getBearerToken,
  isOwnedPayslipObjectPath,
  isRecord,
  isUuid,
  jsonResponse,
  PAYSLIP_BUCKET,
  PAYSLIP_CORS_HEADERS,
  secretsMatch,
} from "../_shared/payslip-upload.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: PAYSLIP_CORS_HEADERS });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const cleanupSecret = Deno.env.get("PAYSLIP_UPLOAD_CLEANUP_SECRET");
  if (!cleanupSecret || !await secretsMatch(cleanupSecret, getBearerToken(request))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { data, error } = await supabase.rpc("list_expired_secure_payslip_upload_sessions", {
      p_user_id: null,
      p_limit: 100,
    });
    if (error || !Array.isArray(data)) {
      console.error("[cleanup-expired-payslip-uploads] listing failed", { code: error?.code ?? "invalid_response" });
      return jsonResponse({ error: "Cleanup could not start." }, 503);
    }

    let removed = 0;
    let deferred = 0;
    for (const entry of data) {
      if (!isRecord(entry) || !isUuid(entry.session_id) || !isUuid(entry.user_id) || !isOwnedPayslipObjectPath(entry.object_path, entry.user_id)) {
        deferred += 1;
        continue;
      }
      const { error: removeError } = await supabase.storage
        .from(PAYSLIP_BUCKET)
        .remove([entry.object_path]);
      if (removeError) {
        deferred += 1;
        continue;
      }
      const { data: settled, error: settleError } = await supabase.rpc("settle_expired_secure_payslip_upload_session", {
        p_session_id: entry.session_id,
        p_user_id: entry.user_id,
      });
      if (settleError || settled !== true) {
        deferred += 1;
      } else {
        removed += 1;
      }
    }

    // A historical failed upload can predate server-owned upload sessions. It
    // still has the same cleanup_requested_at read-link fence, so process that
    // small worklist only after its last short-lived original link has expired.
    const { data: legacyFailedCleanups, error: legacyFailedCleanupError } = await supabase.rpc(
      "list_expired_secure_failed_payslip_cleanups_without_session",
      { p_limit: 100 },
    );
    if (legacyFailedCleanupError || !Array.isArray(legacyFailedCleanups)) {
      console.error("[cleanup-expired-payslip-uploads] legacy failed-upload listing deferred", {
        code: legacyFailedCleanupError?.code ?? "invalid_response",
      });
      deferred += 1;
    } else {
      for (const entry of legacyFailedCleanups) {
        const payslipId = isRecord(entry) && isUuid(entry.payslip_id) ? entry.payslip_id : null;
        const userId = isRecord(entry) && isUuid(entry.user_id) ? entry.user_id : null;
        const objectPath = isRecord(entry) && (typeof entry.object_path === "string" || entry.object_path === null)
          ? entry.object_path
          : undefined;
        if (!payslipId || !userId || objectPath === undefined || (typeof objectPath === "string" && !isOwnedPayslipObjectPath(objectPath, userId))) {
          deferred += 1;
          continue;
        }

        if (typeof objectPath === "string") {
          const { error: removeError } = await supabase.storage
            .from(PAYSLIP_BUCKET)
            .remove([objectPath]);
          if (removeError) {
            deferred += 1;
            continue;
          }
        }

        const { data: deleted, error: deleteError } = await supabase.rpc(
          "delete_failed_payslip_after_storage_cleanup",
          { p_payslip_id: payslipId, p_user_id: userId },
        );
        const status = isRecord(deleted) && typeof deleted.status === "string" ? deleted.status : null;
        if (deleteError || (status !== "deleted" && status !== "not_found")) {
          deferred += 1;
        } else {
          removed += 1;
        }
      }
    }

    // The same protected worker also removes expired metadata for the short
    // original-document links. Those leases are a deletion fence, not an
    // access log, so they must not outlive their bounded validity window.
    const { data: prunedReadLeases, error: pruneReadLeasesError } = await supabase.rpc(
      "prune_expired_payslip_original_link_leases",
      { p_limit: 1000 },
    );
    if (pruneReadLeasesError || typeof prunedReadLeases !== "number") {
      console.error("[cleanup-expired-payslip-uploads] read-link lease cleanup deferred", {
        code: pruneReadLeasesError?.code ?? "invalid_response",
      });
    }

    return jsonResponse({
      scanned: data.length,
      removed,
      deferred,
      legacyFailedCleanupsScanned: Array.isArray(legacyFailedCleanups) ? legacyFailedCleanups.length : 0,
      readLinkLeasesPruned: typeof prunedReadLeases === "number" ? prunedReadLeases : 0,
    });
  } catch (error) {
    console.error("[cleanup-expired-payslip-uploads] failed", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse({ error: "Cleanup could not finish." }, 500);
  }
});
