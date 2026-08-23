import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  isOwnedPayslipObjectPath,
  isUuid,
  PAYSLIP_MAX_FILE_BYTES,
} from "./payslip-storage-boundary.ts";

export {
  isOwnedPayslipObjectPath,
  isUuid,
  PAYSLIP_MAX_FILE_BYTES,
};

export const PAYSLIP_BUCKET = "payslips";
export const PAYSLIP_SIGNED_UPLOAD_TTL_SECONDS = 2 * 60 * 60;
export const PAYSLIP_SIGNED_URL_TTL_SECONDS = 60;
export const PAYSLIP_CORS_HEADERS = corsHeaders;

export const SUPPORTED_PAYSLIP_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const DISPLAY_FILENAME_MAX_LENGTH = 96;

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization ? /^Bearer\s+(.+)$/i.exec(authorization.trim()) : null;
  return match?.[1]?.trim() || null;
}

/**
 * The original upload name is only a display label. It is never used in an
 * object key, provider request, or SQL selector.
 */
export function sanitizePayslipDisplayFileName(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;

  const finalSegment = value
    .normalize("NFKC")
    .replace(/[\\/]+/g, "/")
    .split("/")
    .pop() ?? "";
  const sanitized = finalSegment
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, DISPLAY_FILENAME_MAX_LENGTH);

  return sanitized || "payslip";
}

export function parseUploadMetadata(value: unknown): {
  displayFileName: string;
  contentType: string;
} | null {
  if (!isRecord(value)) return null;
  const displayFileName = sanitizePayslipDisplayFileName(value.fileName);
  const contentType = value.contentType;
  if (!displayFileName || typeof contentType !== "string" || !SUPPORTED_PAYSLIP_MIME_TYPES.has(contentType)) {
    return null;
  }
  return { displayFileName, contentType };
}

export async function bodyAsJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function isSupportedPayslipMimeType(value: unknown): value is string {
  return typeof value === "string" && SUPPORTED_PAYSLIP_MIME_TYPES.has(value);
}

export async function secretsMatch(expected: string, actual: string | null): Promise<boolean> {
  if (!actual) return false;
  const encoder = new TextEncoder();
  const [expectedHash, actualHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const actualBytes = new Uint8Array(actualHash);
  if (expectedBytes.length !== actualBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ actualBytes[index];
  }
  return difference === 0;
}
