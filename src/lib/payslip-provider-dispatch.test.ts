import { describe, expect, it } from "vitest";
import {
  buildPayslipExtractionProviderRequest,
  PAYSLIP_PROVIDER_ENDPOINT,
  PAYSLIP_PROVIDER_MODEL,
  PAYSLIP_PROVIDER_RESPONSE_FORMAT,
} from "../../supabase/functions/_shared/payslip-provider-dispatch.ts";

function validRequest() {
  return buildPayslipExtractionProviderRequest({
    apiKey: "server-only-secret",
    mimeType: "application/pdf",
    fileBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer,
  });
}

describe("payslip provider dispatch boundary", () => {
  it("uses the direct OpenAI API, strict structured output, and a server-derived PDF file part", () => {
    const request = validRequest();
    expect(request).not.toBeNull();
    expect(request?.endpoint).toBe("https://api.openai.com/v1/chat/completions");
    expect(request?.endpoint).toBe(PAYSLIP_PROVIDER_ENDPOINT);
    expect(request?.init.method).toBe("POST");
    expect(request?.init.headers).toMatchObject({
      Authorization: "Bearer server-only-secret",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(String(request?.init.body));
    expect(body.model).toBe(PAYSLIP_PROVIDER_MODEL);
    expect(body.model).toBe("gpt-5.4");
    expect(body.stream).toBe(false);
    expect(body.response_format).toEqual(PAYSLIP_PROVIDER_RESPONSE_FORMAT);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.required).toContain("document_context");
    expect(body.response_format.json_schema.schema.properties.document_context.properties).toMatchObject({
      tax_code: { type: ["string", "null"] },
      pay_frequency: { enum: ["weekly", "fortnightly", "four_weekly", "monthly", "annual", "other", null] },
    });
    expect(body.messages[1].content[0]).toEqual({
      type: "file",
      file: {
        filename: "payslip.pdf",
        file_data: "data:application/pdf;base64,JVBERi0=",
      },
    });
  });

  it("uses a high-detail image part for image payslips", () => {
    const request = buildPayslipExtractionProviderRequest({
      apiKey: "server-only-secret",
      mimeType: "image/png",
      fileBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
    });
    const body = JSON.parse(String(request?.init.body));
    expect(body.messages[1].content[0]).toEqual({
      type: "image_url",
      image_url: {
        url: "data:image/png;base64,iVBORw==",
        detail: "high",
      },
    });
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
    expect(body).not.toContain("lovable");
  });
});
