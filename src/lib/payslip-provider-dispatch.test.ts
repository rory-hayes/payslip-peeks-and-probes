import { describe, expect, it } from "vitest";
import {
  buildPayslipExtractionProviderRequest,
  PAYSLIP_PROVIDER_ENDPOINT,
  PAYSLIP_PROVIDER_MODEL,
} from "../../supabase/functions/_shared/payslip-provider-dispatch.ts";

function validRequest() {
  return buildPayslipExtractionProviderRequest({
    apiKey: "server-only-secret",
    mimeType: "application/pdf",
    fileBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer,
  });
}

describe("payslip provider dispatch boundary", () => {
  it("uses a fixed endpoint, model, and server-derived data URL", () => {
    const request = validRequest();
    expect(request).not.toBeNull();
    expect(request?.endpoint).toBe(PAYSLIP_PROVIDER_ENDPOINT);
    expect(request?.init.method).toBe("POST");
    expect(request?.init.headers).toMatchObject({
      Authorization: "Bearer server-only-secret",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(String(request?.init.body));
    expect(body.model).toBe(PAYSLIP_PROVIDER_MODEL);
    expect(body.messages[1].content[0].image_url.url).toBe("data:application/pdf;base64,JVBERi0=");
  });

  it("does not form a confidential-document request for unsupported MIME, empty bytes, or an absent server secret", () => {
    expect(buildPayslipExtractionProviderRequest({
      apiKey: "server-only-secret",
      mimeType: "text/plain",
      fileBytes: new Uint8Array([1]).buffer,
    })).toBeNull();
    expect(buildPayslipExtractionProviderRequest({
      apiKey: "server-only-secret",
      mimeType: "application/pdf",
      fileBytes: new ArrayBuffer(0),
    })).toBeNull();
    expect(buildPayslipExtractionProviderRequest({
      apiKey: "",
      mimeType: "application/pdf",
      fileBytes: new Uint8Array([1]).buffer,
    })).toBeNull();
  });

  it("contains only the extraction instructions and document data, never customer metadata", () => {
    const request = validRequest();
    const body = String(request?.init.body);
    expect(body).not.toContain("rory@example.com");
    expect(body).not.toContain("payroll-july.pdf");
    expect(body).not.toContain("5cd4d08e-a1ea-438f-a8d5-8d75c4c8bef8");
    expect(body).not.toContain("payslips/");
  });
});
