import type { SupportedPayslipMimeType } from "./payslip-file-validation.ts";
import { PAYSLIP_MAX_FILE_BYTES } from "./payslip-storage-boundary.ts";

export const PAYSLIP_PROVIDER_ENDPOINT = "https://ai-gateway.vercel.sh/v1/chat/completions";
export const PAYSLIP_PROVIDER_MODEL = "openai/gpt-5.4";

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

const NULLABLE_MONEY_SCHEMA = { type: ["number", "null"] } as const;
const NULLABLE_TEXT_SCHEMA = { type: ["string", "null"] } as const;

/**
 * The provider contract is deliberately kept beside the request builder. It
 * is sent to the gateway as strict structured output, then independently
 * validated by process-payslip before anything is saved.
 */
export const PAYSLIP_PROVIDER_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "payslip_extraction",
    description: "The visible financial fields transcribed from one payslip.",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        pay_date: NULLABLE_TEXT_SCHEMA,
        pay_period_start: NULLABLE_TEXT_SCHEMA,
        pay_period_end: NULLABLE_TEXT_SCHEMA,
        employer_name: NULLABLE_TEXT_SCHEMA,
        country: {
          type: ["string", "null"],
          enum: ["UK", "Ireland", null],
        },
        gross_pay: NULLABLE_MONEY_SCHEMA,
        net_pay: NULLABLE_MONEY_SCHEMA,
        taxable_pay: NULLABLE_MONEY_SCHEMA,
        tax_amount: NULLABLE_MONEY_SCHEMA,
        national_insurance_amount: NULLABLE_MONEY_SCHEMA,
        prsi_amount: NULLABLE_MONEY_SCHEMA,
        usc_amount: NULLABLE_MONEY_SCHEMA,
        social_security_amount: NULLABLE_MONEY_SCHEMA,
        solidarity_amount: NULLABLE_MONEY_SCHEMA,
        church_tax_amount: NULLABLE_MONEY_SCHEMA,
        pension_amount: NULLABLE_MONEY_SCHEMA,
        student_loan_amount: NULLABLE_MONEY_SCHEMA,
        bonus_amount: NULLABLE_MONEY_SCHEMA,
        overtime_amount: NULLABLE_MONEY_SCHEMA,
        total_deductions: NULLABLE_MONEY_SCHEMA,
        year_to_date: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                gross_pay: NULLABLE_MONEY_SCHEMA,
                tax: NULLABLE_MONEY_SCHEMA,
                ni: NULLABLE_MONEY_SCHEMA,
                pension: NULLABLE_MONEY_SCHEMA,
              },
              required: ["gross_pay", "tax", "ni", "pension"],
            },
            { type: "null" },
          ],
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
        },
      },
      required: [
        "pay_date",
        "pay_period_start",
        "pay_period_end",
        "employer_name",
        "country",
        "gross_pay",
        "net_pay",
        "taxable_pay",
        "tax_amount",
        "national_insurance_amount",
        "prsi_amount",
        "usc_amount",
        "social_security_amount",
        "solidarity_amount",
        "church_tax_amount",
        "pension_amount",
        "student_loan_amount",
        "bonus_amount",
        "overtime_amount",
        "total_deductions",
        "year_to_date",
        "confidence",
      ],
    },
  },
} as const;

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

  const documentContent = input.mimeType === "application/pdf"
    ? {
        type: "file",
        file: {
          filename: "payslip.pdf",
          file_data: `data:${input.mimeType};base64,${base64}`,
        },
      }
    : {
        type: "image_url",
        image_url: {
          url: `data:${input.mimeType};base64,${base64}`,
          detail: "high",
        },
      };

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
        stream: false,
        response_format: PAYSLIP_PROVIDER_RESPONSE_FORMAT,
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              documentContent,
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
