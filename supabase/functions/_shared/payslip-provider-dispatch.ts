import type { SupportedPayslipMimeType } from "./payslip-file-validation.ts";
import { PAYSLIP_MAX_FILE_BYTES } from "./payslip-storage-boundary.ts";

export const PAYSLIP_PROVIDER_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const PAYSLIP_PROVIDER_MODEL = "gpt-5.4";

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
  "currency": "GBP or EUR or null",
  "document_context": {
    "tax_code": "string or null",
    "national_insurance_category": "string or null",
    "prsi_class": "string or null",
    "pay_frequency": "weekly | fortnightly | four_weekly | monthly | annual | other | null",
    "pay_basis": "string or null"
  },
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
  "line_items": [
    {
      "label": "string",
      "kind": "earning | deduction | employer_contribution | information",
      "amount": number or null,
      "year_to_date_amount": number or null,
      "evidence": "short label-and-amount text or null",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "field_evidence": [
    {
      "field": "canonical field name",
      "evidence": "short exact label-and-amount text or null",
      "confidence": "high" | "medium" | "low"
    }
  ],
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
- Capture a visible tax code, National Insurance category, PRSI class, pay frequency, or pay basis in document_context. These are useful context, not proof that payroll is correct.
- Student loan, bonus, overtime and total deductions should be recorded only where clearly shown.
- Include every distinct earning, deduction, employer contribution, and other financial line that is visibly printed. Do not include names, addresses, bank details, employee IDs, or other personal identifiers. A tax code is allowed only in document_context because it helps explain a payroll deduction.
- Keep line-item amounts positive and use the "kind" field to describe whether the row is an earning or deduction. Do not calculate missing amounts or totals.
- The "evidence" field must be a short exact label-and-amount fragment from the document, never a personal identifier or a paragraph.
- The "field_evidence" array should include only fields supported by visible text. Use the canonical field name from the schema, or "line_item" for a row-specific fragment.

Rules:
- All monetary values should be plain numbers (no currency symbols, no thousand separators)
- Use the EMPLOYEE share, NOT the employer share
- Be precise with decimal values
- Do not calculate, infer, or give tax advice. Only transcribe fields visible on the document.
- Do not guess document_context values. Use null when the relevant label is not clearly visible.
- Only return the JSON object, no other text`;

const NULLABLE_MONEY_SCHEMA = { type: ["number", "null"] } as const;
const NULLABLE_TEXT_SCHEMA = { type: ["string", "null"] } as const;

/**
 * The provider contract is deliberately kept beside the request builder. It
 * is sent to the provider as strict structured output, then independently
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
        currency: {
          type: ["string", "null"],
          enum: ["GBP", "EUR", null],
        },
        document_context: {
          type: "object",
          additionalProperties: false,
          properties: {
            tax_code: NULLABLE_TEXT_SCHEMA,
            national_insurance_category: NULLABLE_TEXT_SCHEMA,
            prsi_class: NULLABLE_TEXT_SCHEMA,
            pay_frequency: {
              type: ["string", "null"],
              enum: ["weekly", "fortnightly", "four_weekly", "monthly", "annual", "other", null],
            },
            pay_basis: NULLABLE_TEXT_SCHEMA,
          },
          required: ["tax_code", "national_insurance_category", "prsi_class", "pay_frequency", "pay_basis"],
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
        line_items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              kind: {
                type: "string",
                enum: ["earning", "deduction", "employer_contribution", "information"],
              },
              amount: NULLABLE_MONEY_SCHEMA,
              year_to_date_amount: NULLABLE_MONEY_SCHEMA,
              evidence: NULLABLE_TEXT_SCHEMA,
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
            },
            required: ["label", "kind", "amount", "year_to_date_amount", "evidence", "confidence"],
          },
        },
        field_evidence: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              field: { type: "string" },
              evidence: NULLABLE_TEXT_SCHEMA,
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
            },
            required: ["field", "evidence", "confidence"],
          },
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
        "currency",
        "document_context",
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
        "line_items",
        "field_evidence",
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
