import type { SupportedPayslipMimeType } from "./payslip-file-validation.ts";
import { PAYSLIP_MAX_FILE_BYTES } from "./payslip-storage-boundary.ts";

export const PAYSLIP_PROVIDER_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const PAYSLIP_PROVIDER_MODEL = "google/gemini-2.5-flash";

const SUPPORTED_PROVIDER_MIME_TYPES = new Set<SupportedPayslipMimeType>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const EXTRACTION_PROMPT = `You are a payslip data extraction assistant. Analyze this payslip document and extract all financial data.

Return a JSON object using this exact schema (use null for fields you cannot find):

{
  "pay_date": "YYYY-MM-DD or null",
  "pay_period_start": "YYYY-MM-DD or null",
  "pay_period_end": "YYYY-MM-DD or null",
  "employer_name": "string or null",
  "country": "UK or Ireland or null",
  "gross_pay": number or null,
  "net_pay": number or null,
  "taxable_pay": number or null,
  "tax_amount": number or null,
  "national_insurance_amount": number or null,
  "prsi_amount": number or null,
  "usc_amount": number or null,
  "social_security_amount": number or null,
  "solidarity_amount": number or null,
  "church_tax_amount": number or null,
  "pension_amount": number or null,
  "student_loan_amount": number or null,
  "bonus_amount": number or null,
  "overtime_amount": number or null,
  "total_deductions": number or null,
  "year_to_date": {
    "gross_pay": number or null,
    "tax": number or null,
    "ni": number or null,
    "pension": number or null
  },
  "confidence": "high" | "medium" | "low"
}

Country detection:
- If PRSI or USC are present, country is Ireland.
- If "National Insurance" / "NI" / "PAYE" with £ is present, country is UK.
- If the payslip is not clearly from the UK or Ireland, use null rather than guessing.

UK and Ireland field mapping:
- Gross pay / gross earnings → gross_pay.
- Net pay / take-home pay → net_pay.
- Income tax / PAYE tax → tax_amount.
- National Insurance → national_insurance_amount.
- PRSI → prsi_amount; USC → usc_amount.
- Employee pension contribution → pension_amount.
- Student loan, bonus, overtime and total deductions should be recorded only where clearly shown.

Rules:
- All monetary values should be plain numbers (no currency symbols, no thousand separators)
- Use the EMPLOYEE share, NOT the employer share
- Be precise with decimal values
- Do not calculate, infer, or give tax advice. Only transcribe fields visible on the document.
- Only return the JSON object, no other text`;

export interface PayslipProviderDispatchRequest {
  endpoint: string;
  init: RequestInit;
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * Constructs the only permitted confidential-document egress request. The
 * handler passes only server-derived MIME and bytes; customer IDs, file names,
 * storage paths, and payment/account data cannot enter this payload.
 */
export function buildPayslipExtractionProviderRequest(input: {
  apiKey: unknown;
  mimeType: unknown;
  fileBytes: unknown;
}): PayslipProviderDispatchRequest | null {
  if (
    typeof input.apiKey !== "string"
    || input.apiKey.trim().length === 0
    || !SUPPORTED_PROVIDER_MIME_TYPES.has(input.mimeType as SupportedPayslipMimeType)
    || !(input.fileBytes instanceof ArrayBuffer)
    || input.fileBytes.byteLength < 1
    || input.fileBytes.byteLength > PAYSLIP_MAX_FILE_BYTES
  ) {
    return null;
  }

  let base64: string;
  try {
    base64 = arrayBufferToBase64(input.fileBytes);
  } catch {
    return null;
  }

  return {
    endpoint: PAYSLIP_PROVIDER_ENDPOINT,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PAYSLIP_PROVIDER_MODEL,
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.mimeType};base64,${base64}`,
                },
              },
              {
                type: "text",
                text: "Extract all financial data from this payslip.",
              },
            ],
          },
        ],
      }),
    },
  };
}
