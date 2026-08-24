const MAX_MONEY_VALUE = 10_000_000;

export interface Extraction {
  gross_pay: number | null;
  net_pay: number | null;
  taxable_pay: number | null;
  tax_amount: number | null;
  national_insurance_amount: number | null;
  prsi_amount: number | null;
  usc_amount: number | null;
  social_security_amount: number | null;
  solidarity_amount: number | null;
  church_tax_amount: number | null;
  pension_amount: number | null;
  student_loan_amount: number | null;
  bonus_amount: number | null;
  overtime_amount: number | null;
  total_deductions: number | null;
}

export type ExtractionLineItemKind = "earning" | "deduction" | "employer_contribution" | "information";
export type ExtractionConfidence = "high" | "medium" | "low";

export type ExtractionPayFrequency = "weekly" | "fortnightly" | "four_weekly" | "monthly" | "annual" | "other" | null;

/**
 * Non-identifying payroll context that helps a person understand why a
 * deduction may have changed. Employee IDs, addresses, bank details, and
 * other personal identifiers deliberately do not belong here.
 */
export interface ExtractionDocumentContext {
  tax_code: string | null;
  national_insurance_category: string | null;
  prsi_class: string | null;
  pay_frequency: ExtractionPayFrequency;
  pay_basis: string | null;
}

export interface ExtractionLineItem {
  label: string;
  kind: ExtractionLineItemKind;
  amount: number | null;
  year_to_date_amount: number | null;
  evidence: string | null;
  confidence: ExtractionConfidence;
}

export interface ExtractionFieldEvidence {
  field: string;
  evidence: string | null;
  confidence: ExtractionConfidence;
}

export interface ParsedExtraction extends Extraction {
  pay_date: string | null;
  pay_period_start: string | null;
  pay_period_end: string | null;
  employer_name: string | null;
  country: "UK" | "Ireland" | null;
  currency: "GBP" | "EUR" | null;
  year_to_date: {
    gross_pay: number | null;
    tax: number | null;
    ni: number | null;
    pension: number | null;
  } | null;
  document_context: ExtractionDocumentContext;
  line_items: ExtractionLineItem[];
  field_evidence: ExtractionFieldEvidence[];
  confidence: ExtractionConfidence;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Missing money fields are expected; non-numeric fields are not. Rejecting a
 * malformed response avoids persisting invented or string-coerced figures.
 */
function nullableMoney(value: unknown): number | null | undefined {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > MAX_MONEY_VALUE) {
    return undefined;
  }
  return value;
}

function nullableText(value: unknown, maxLength: number): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length <= maxLength ? trimmed : undefined;
}

export function nullableCountry(value: unknown): "UK" | "Ireland" | null | undefined {
  if (value == null || value === "") return null;
  if (value === "UK" || value === "Ireland") return value;
  if (typeof value !== "string") return undefined;
  return null;
}

function nullableCurrency(value: unknown): "GBP" | "EUR" | null | undefined {
  if (value == null || value === "") return null;
  if (value === "GBP" || value === "EUR") return value;
  return undefined;
}

function nullableConfidence(value: unknown): ExtractionConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function nullablePayFrequency(value: unknown): ExtractionPayFrequency | undefined {
  if (value == null || value === "") return null;
  if (value === "weekly" || value === "fortnightly" || value === "four_weekly" || value === "monthly" || value === "annual" || value === "other") {
    return value;
  }
  return undefined;
}

function parseDocumentContext(value: unknown): ExtractionDocumentContext | undefined {
  if (!isPlainObject(value)) return undefined;

  const taxCode = nullableText(value.tax_code, 40);
  const nationalInsuranceCategory = nullableText(value.national_insurance_category, 20);
  const prsiClass = nullableText(value.prsi_class, 20);
  const payFrequency = nullablePayFrequency(value.pay_frequency);
  const payBasis = nullableText(value.pay_basis, 40);

  if ([taxCode, nationalInsuranceCategory, prsiClass, payFrequency, payBasis].some((field) => field === undefined)) {
    return undefined;
  }

  return {
    tax_code: taxCode,
    national_insurance_category: nationalInsuranceCategory,
    prsi_class: prsiClass,
    pay_frequency: payFrequency,
    pay_basis: payBasis,
  };
}

function parseLineItems(value: unknown): ExtractionLineItem[] | undefined {
  if (!Array.isArray(value) || value.length > 60) return undefined;

  const parsed: ExtractionLineItem[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return undefined;
    const label = nullableText(item.label, 120);
    const kind = item.kind;
    const amount = nullableMoney(item.amount);
    const yearToDateAmount = nullableMoney(item.year_to_date_amount);
    const evidence = nullableText(item.evidence, 300);
    if (
      !label
      || (kind !== "earning" && kind !== "deduction" && kind !== "employer_contribution" && kind !== "information")
      || amount === undefined
      || yearToDateAmount === undefined
      || evidence === undefined
    ) {
      return undefined;
    }
    parsed.push({
      label,
      kind,
      amount,
      year_to_date_amount: yearToDateAmount,
      evidence,
      confidence: nullableConfidence(item.confidence),
    });
  }
  return parsed;
}

function parseFieldEvidence(value: unknown): ExtractionFieldEvidence[] | undefined {
  if (!Array.isArray(value) || value.length > 40) return undefined;

  const parsed: ExtractionFieldEvidence[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return undefined;
    const field = nullableText(item.field, 80);
    const evidence = nullableText(item.evidence, 300);
    if (!field || evidence === undefined) return undefined;
    parsed.push({
      field,
      evidence,
      confidence: nullableConfidence(item.confidence),
    });
  }
  return parsed;
}

function parseYearToDate(value: unknown): ParsedExtraction["year_to_date"] | undefined {
  if (value == null) return null;
  if (!isPlainObject(value)) return undefined;

  const grossPay = nullableMoney(value.gross_pay);
  const tax = nullableMoney(value.tax);
  const ni = nullableMoney(value.ni);
  const pension = nullableMoney(value.pension);
  if ([grossPay, tax, ni, pension].some((amount) => amount === undefined)) {
    return undefined;
  }

  return {
    gross_pay: grossPay,
    tax,
    ni,
    pension,
  };
}

export function parseExtraction(value: unknown): ParsedExtraction | null {
  if (!isPlainObject(value)) return null;

  const grossPay = nullableMoney(value.gross_pay);
  const netPay = nullableMoney(value.net_pay);
  const taxablePay = nullableMoney(value.taxable_pay);
  const taxAmount = nullableMoney(value.tax_amount);
  const nationalInsuranceAmount = nullableMoney(value.national_insurance_amount);
  const prsiAmount = nullableMoney(value.prsi_amount);
  const uscAmount = nullableMoney(value.usc_amount);
  const socialSecurityAmount = nullableMoney(value.social_security_amount);
  const solidarityAmount = nullableMoney(value.solidarity_amount);
  const churchTaxAmount = nullableMoney(value.church_tax_amount);
  const pensionAmount = nullableMoney(value.pension_amount);
  const studentLoanAmount = nullableMoney(value.student_loan_amount);
  const bonusAmount = nullableMoney(value.bonus_amount);
  const overtimeAmount = nullableMoney(value.overtime_amount);
  const totalDeductions = nullableMoney(value.total_deductions);
  const payDate = nullableText(value.pay_date, 40);
  const payPeriodStart = nullableText(value.pay_period_start, 40);
  const payPeriodEnd = nullableText(value.pay_period_end, 40);
  const employerName = nullableText(value.employer_name, 200);
  const country = nullableCountry(value.country);
  const currency = nullableCurrency(value.currency);
  const yearToDate = parseYearToDate(value.year_to_date);
  const documentContext = parseDocumentContext(value.document_context);
  const lineItems = parseLineItems(value.line_items);
  const fieldEvidence = parseFieldEvidence(value.field_evidence);

  if ([
    grossPay,
    netPay,
    taxablePay,
    taxAmount,
    nationalInsuranceAmount,
    prsiAmount,
    uscAmount,
    socialSecurityAmount,
    solidarityAmount,
    churchTaxAmount,
    pensionAmount,
    studentLoanAmount,
    bonusAmount,
    overtimeAmount,
    totalDeductions,
    payDate,
    payPeriodStart,
    payPeriodEnd,
    employerName,
    country,
    currency,
    yearToDate,
    documentContext,
    lineItems,
    fieldEvidence,
  ].some((field) => field === undefined)) {
    return null;
  }

  return {
    gross_pay: grossPay,
    net_pay: netPay,
    taxable_pay: taxablePay,
    tax_amount: taxAmount,
    national_insurance_amount: nationalInsuranceAmount,
    prsi_amount: prsiAmount,
    usc_amount: uscAmount,
    social_security_amount: socialSecurityAmount,
    solidarity_amount: solidarityAmount,
    church_tax_amount: churchTaxAmount,
    pension_amount: pensionAmount,
    student_loan_amount: studentLoanAmount,
    bonus_amount: bonusAmount,
    overtime_amount: overtimeAmount,
    total_deductions: totalDeductions,
    pay_date: payDate,
    pay_period_start: payPeriodStart,
    pay_period_end: payPeriodEnd,
    employer_name: employerName,
    country,
    currency,
    year_to_date: yearToDate,
    document_context: documentContext,
    line_items: lineItems,
    field_evidence: fieldEvidence,
    confidence: nullableConfidence(value.confidence),
  };
}
