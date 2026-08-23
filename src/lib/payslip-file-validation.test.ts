import { describe, expect, it } from "vitest";
import {
  detectPayslipMimeType,
  fetchProviderJsonWithTimeout,
} from "../../supabase/functions/_shared/payslip-file-validation.ts";

describe("payslip file signature validation", () => {
  it.each([
    [[0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], "application/pdf"],
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00], "image/png"],
    [[0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], "image/jpeg"],
    [[0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50], "image/webp"],
  ] as const)("accepts a real %s signature", (bytes, mimeType) => {
    expect(detectPayslipMimeType(new Uint8Array(bytes))).toBe(mimeType);
  });

  it("rejects a renamed or browser-labelled file whose bytes are not a supported payslip format", () => {
    expect(detectPayslipMimeType(new TextEncoder().encode("not a PDF despite the .pdf filename"))).toBeNull();
    expect(detectPayslipMimeType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00]))).toBeNull();
  });
});

describe("provider request timeout", () => {
  it("aborts a stalled request and returns a non-private timeout result", async () => {
    let receivedSignal: AbortSignal | undefined;
    const result = await fetchProviderJsonWithTimeout(
      async (_input, init) => new Promise<Response>((_resolve, reject) => {
        receivedSignal = init?.signal ?? undefined;
        receivedSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      }),
      "https://provider.invalid/extract",
      { method: "POST" },
      5,
    );

    expect(receivedSignal?.aborted).toBe(true);
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("does not expose an underlying provider error", async () => {
    const result = await fetchProviderJsonWithTimeout(
      async () => Promise.reject(new Error("provider included private document content")),
      "https://provider.invalid/extract",
      { method: "POST" },
      100,
    );

    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  it("keeps the deadline active while a successful response body is being read", async () => {
    let receivedSignal: AbortSignal | undefined;
    const result = await fetchProviderJsonWithTimeout(
      async (_input, init) => {
        receivedSignal = init?.signal ?? undefined;
        return {
          ok: true,
          json: () => new Promise<unknown>((_resolve, reject) => {
            receivedSignal?.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          }),
        } as Response;
      },
      "https://provider.invalid/extract",
      { method: "POST" },
      5,
    );

    expect(receivedSignal?.aborted).toBe(true);
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });
});
