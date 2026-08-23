/**
 * These are intentionally signature checks rather than filename or browser
 * MIME checks. The extraction service receives a service-role Storage blob,
 * so the server must establish the content type again before it can leave our
 * infrastructure.
 */
export type SupportedPayslipMimeType =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

/**
 * Returns a provider-safe MIME type only when the downloaded bytes identify
 * one of the small set of formats the payslip extractor supports. This is not
 * a full document parser; it deliberately verifies the relevant container
 * magic bytes at the trust boundary before provider dispatch.
 */
export function detectPayslipMimeType(bytes: Uint8Array): SupportedPayslipMimeType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

export type ProviderFetchFailure = "timeout" | "network_error" | "invalid_response";

export type ProviderJsonFetchResult =
  | { ok: true; response: Response; data: unknown }
  | { ok: false; reason: ProviderFetchFailure };

export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * The private document may already be in-flight when the timeout occurs, so
 * callers must treat timeout and transport/body failures as dispatched
 * failures and must not release a quota reservation. The deadline covers the
 * response body too: a provider can return headers then stall while streaming
 * JSON, which must not hold a payslip-processing lock indefinitely.
 * Deliberately do not expose a provider/network exception to callers or logs.
 */
export async function fetchProviderJsonWithTimeout(
  fetchImplementation: FetchImplementation,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<ProviderJsonFetchResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImplementation(input, {
      ...init,
      signal: controller.signal,
    });
    if (timedOut) return { ok: false, reason: "timeout" };

    // Callers only need a body for a successful provider response. Keeping
    // error responses header-only avoids unnecessarily reading provider text
    // that may include diagnostic details we never surface to customers.
    if (!response.ok) return { ok: true, response, data: null };

    try {
      const data = await response.json();
      return timedOut
        ? { ok: false, reason: "timeout" }
        : { ok: true, response, data };
    } catch {
      return { ok: false, reason: timedOut ? "timeout" : "invalid_response" };
    }
  } catch {
    return { ok: false, reason: timedOut ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timeoutId);
  }
}
