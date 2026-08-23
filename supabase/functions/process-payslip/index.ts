import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import {
  detectPayslipMimeType,
  fetchProviderJsonWithTimeout,
} from "../_shared/payslip-file-validation.ts";
import { PAYSLIP_MAX_FILE_BYTES, isOwnedPayslipObjectPath } from "../_shared/payslip-storage-boundary.ts";
import { buildPayslipExtractionProviderRequest } from "../_shared/payslip-provider-dispatch.ts";

// ---------- Date normalisation ----------

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function normaliseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  // Already ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    if (!isNaN(d.getTime()) && d.getUTCDate() === +iso[3]) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const [, dd, mm, yy] = dmy;
    let year = parseInt(yy);
    if (year < 100) year += 2000;
    const month = parseInt(mm);
    const day = parseInt(dd);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (d.getUTCDate() === day && d.getUTCMonth() === month - 1) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  // Textual: "31 March 2026" or "March 31, 2026" etc.
  const textDMY = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (textDMY) {
    const day = parseInt(textDMY[1]);
    const month = MONTH_MAP[textDMY[2].toLowerCase()];
    let year = parseInt(textDMY[3]);
    if (year < 100) year += 2000;
    if (month !== undefined && day >= 1 && day <= 31) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const textMDY = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (textMDY) {
    const month = MONTH_MAP[textMDY[1].toLowerCase()];
    const day = parseInt(textMDY[2]);
    let year = parseInt(textMDY[3]);
    if (year < 100) year += 2000;
    if (month !== undefined && day >= 1 && day <= 31) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  // Error states can reveal whether an account has a pending document, quota,
  // or extraction result. Never allow a browser/proxy to reuse them.
  "Cache-Control": "no-store",
};

// ---------- Anomaly detection ----------

interface Extraction {
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

interface ParsedExtraction extends Extraction {
  pay_date: string | null;
  pay_period_start: string | null;
  pay_period_end: string | null;
  employer_name: string | null;
  country: "UK" | "Ireland" | null;
  year_to_date: {
    gross_pay: number | null;
    tax: number | null;
    ni: number | null;
    pension: number | null;
  } | null;
  confidence: "high" | "medium" | "low";
}

const MAX_MONEY_VALUE = 10_000_000;
const MAX_PROCESSING_ATTEMPTS = 3;
const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

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

function nullableCountry(value: unknown): "UK" | "Ireland" | null | undefined {
  if (value == null || value === "") return null;
  if (value === "UK" || value === "Ireland") return value;
  if (typeof value !== "string") return undefined;
  return null;
}

function nullableConfidence(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
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

function parseExtraction(value: unknown): ParsedExtraction | null {
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
  const yearToDate = parseYearToDate(value.year_to_date);

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
    yearToDate,
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
    year_to_date: yearToDate,
    confidence: nullableConfidence(value.confidence),
  };
}

function assistantContent(value: unknown): string | null {
  if (!isPlainObject(value) || !Array.isArray(value.choices)) return null;
  const firstChoice = value.choices[0];
  if (!isPlainObject(firstChoice) || !isPlainObject(firstChoice.message)) return null;
  return typeof firstChoice.message.content === "string" ? firstChoice.message.content : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function markProcessingFailed(
  supabase: SupabaseClient,
  userId: string,
  payslipId: string,
  processingToken: string,
  failureCode: string,
  releaseUnstartedReservation = false,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("fail_payslip_processing", {
    p_payslip_id: payslipId,
    p_user_id: userId,
    p_processing_token: processingToken,
    p_failure_code: failureCode,
    p_release_unstarted_reservation: releaseUnstartedReservation,
  });

  if (error || data !== true) {
    console.error("[process-payslip] failed to record processing failure", {
      code: error?.code ?? null,
      failureCode,
    });
    return false;
  }
  return true;
}

async function markProviderStarted(
  supabase: SupabaseClient,
  userId: string,
  payslipId: string,
  processingToken: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_secure_payslip_provider_started", {
    p_payslip_id: payslipId,
    p_user_id: userId,
    p_processing_token: processingToken,
  });
  if (error || data !== true) {
    console.error("[process-payslip] could not mark provider dispatch", { code: error?.code ?? null });
    return false;
  }
  return true;
}

interface Anomaly {
  anomaly_type: string;
  severity: "low" | "medium" | "high";
  confidence: string;
  title: string;
  description: string;
  suggested_action: string;
}

function runAnomalyChecks(
  current: Extraction,
  previous: Extraction | null,
  country: string | null,
  threshold = 5
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const c = (country ?? "").toLowerCase();
  const isIreland = c === "ireland";
  const isGermany = c === "germany";
  const isFrance = c === "france";
  const isNetherlands = c === "netherlands";
  const isSpain = c === "spain";
  const isItaly = c === "italy";
  const isBelgium = c === "belgium";
  const isPortugal = c === "portugal";
  const isEurZone = isIreland || isGermany || isFrance || isNetherlands || isSpain || isItaly || isBelgium || isPortugal;
  // Countries where the payslip shows a discrete social-security/contributions line we should check
  const expectsSocialSecurity = isFrance || isSpain || isItaly || isBelgium || isPortugal;
  const sym = isEurZone ? "€" : "£";

  const pct = (curr: number, prev: number) =>
    prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : curr !== 0 ? 100 : 0;

  // ─── Standalone checks (no comparison needed) ───

  if (current.gross_pay == null || current.net_pay == null) {
    anomalies.push({
      anomaly_type: "missing_key_fields",
      severity: "high",
      confidence: "high",
      title: "Missing key pay fields",
      description: "What changed: We couldn't extract gross pay or net pay from this payslip.\n\nWhy it matters: Without these core figures, we can't run meaningful checks on your pay. The values may be in an unusual format or location on the document.\n\nHere's what changed and why it may need review.",
      suggested_action: "Open your original payslip document and manually confirm the gross and net pay values. Then edit them in the review screen to ensure your records are accurate.",
    });
  }

  if (current.net_pay != null && current.gross_pay != null && current.net_pay > current.gross_pay) {
    anomalies.push({
      anomaly_type: "net_exceeds_gross",
      severity: "high",
      confidence: "high",
      title: "Net pay is higher than gross pay",
      description: `What changed: Your net pay (${sym}${current.net_pay.toFixed(2)}) is higher than your gross pay (${sym}${current.gross_pay.toFixed(2)}).\n\nWhy it matters: Normally, deductions reduce your gross pay to produce a lower net figure. When net exceeds gross, it usually means there's a refund, back-pay adjustment, or an extraction error.\n\nThis may be perfectly valid, but it's worth checking.`,
      suggested_action: "Check your payslip for any tax refunds, back-pay adjustments, or expense reimbursements that might explain this. If none apply, ask your payroll team to clarify.",
    });
  }

  if (current.net_pay != null && current.net_pay < 0) {
    anomalies.push({
      anomaly_type: "negative_net_pay",
      severity: "high",
      confidence: "high",
      title: "Negative net pay",
      description: `What changed: Your net pay is ${sym}${current.net_pay.toFixed(2)}, which is a negative amount.\n\nWhy it matters: A negative net pay is extremely unusual. It typically means your employer is recovering an overpayment, or deductions exceeded your earnings this period. This directly affects the money reaching your account.\n\nHere's what changed and why it may need review.`,
      suggested_action: "Contact your payroll team as soon as possible to understand why your net pay is negative. Ask for a written breakdown of any overpayment recovery or adjustment being applied.",
    });
  }

  if (current.gross_pay != null && current.gross_pay < 0) {
    anomalies.push({
      anomaly_type: "negative_gross_pay",
      severity: "high",
      confidence: "high",
      title: "Negative gross pay",
      description: `What changed: Your gross pay is showing as ${sym}${current.gross_pay.toFixed(2)}, which is a negative amount.\n\nWhy it matters: Negative gross pay shouldn't normally occur. This is most likely an extraction error where the value was read incorrectly from your payslip.\n\nHere's what changed and why it may need review.`,
      suggested_action: "Check the original payslip document to confirm the gross pay figure. If the extraction was wrong, edit the value in the review screen.",
    });
  }

  // Missing tax deduction (standalone — no comparison needed)
  if (current.gross_pay != null && current.gross_pay > 0 && (current.tax_amount == null || current.tax_amount === 0)) {
    anomalies.push({
      anomaly_type: "missing_tax",
      severity: "medium",
      confidence: "medium",
      title: "No tax deduction found",
      description: `What changed: Your payslip shows gross pay of ${sym}${current.gross_pay.toFixed(2)} but no income tax deduction.\n\nWhy it matters: Most employees pay income tax. A missing tax deduction could mean you're on an emergency tax code, your employer hasn't applied the correct code, or there's an extraction error. In rare cases it may be correct (e.g. your personal allowance covers your full salary).\n\nThis may be perfectly valid, but it's worth checking.`,
      suggested_action: isIreland
        ? "Log into Revenue's myAccount and check your tax credits and rate bands. Confirm with payroll that the correct tax credit certificate has been applied."
        : isGermany
          ? "Check your Steuerklasse (tax class) on this payslip — if it's wrong, ask your employer to update it via your local Finanzamt. You can also verify your details in your ELStAM record."
          : isFrance
            ? "Check your taux de prélèvement à la source on impots.gouv.fr. If it looks wrong, you can update your taux personalisé from your espace particulier."
            : isNetherlands
              ? "Check your loonheffingskorting setting with payroll — if you've forgotten to apply it (or it's been applied at a second job too), your loonheffing can be wrong. You can also check your situation on belastingdienst.nl."
              : isSpain
                ? "Check the tipo de retención on your payslip and ask payroll to recalculate it via the Agencia Tributaria's IRPF calculator if your circumstances have changed."
                : isItaly
                  ? "Check your aliquote IRPEF and any detrazioni applied. Ask the ufficio del personale to confirm your situation on the CU and recalculate."
                  : isBelgium
                    ? "Check your barème de précompte / loonschaal with payroll. Ask them to confirm your fiche fiscale 281.10 details."
                    : isPortugal
                      ? "Check your tabela de retenção on your payslip and confirm with RH that the correct one is being used (your IRS situation may have changed)."
                      : "Check your tax code on this payslip and verify it against your HMRC personal tax account at gov.uk. If the code is wrong, ask payroll to update it.",
    });
  }

  // Missing NI (UK) / PRSI (Ireland) / Sozialversicherung (Germany) deduction
  if (current.gross_pay != null && current.gross_pay > 0) {
    if (isIreland) {
      if (current.prsi_amount == null || current.prsi_amount === 0) {
        anomalies.push({
          anomaly_type: "missing_prsi",
          severity: "medium",
          confidence: "medium",
          title: "No PRSI deduction found",
          description: `What changed: Your payslip shows gross pay of €${current.gross_pay.toFixed(2)} but no PRSI contribution.\n\nWhy it matters: Most employees pay PRSI. Missing PRSI could affect your social insurance record and future entitlements (e.g. State Pension, Jobseeker's Benefit). It may be correct if you're exempt, but it's worth confirming.\n\nThis may be perfectly valid, but it's worth checking.`,
          suggested_action: "Check your PRSI class with your employer. If you believe you should be paying PRSI, ask payroll to verify your classification with Revenue.",
        });
      }
    } else if (isGermany) {
      if (current.social_security_amount == null || current.social_security_amount === 0) {
        anomalies.push({
          anomaly_type: "missing_social_security",
          severity: "medium",
          confidence: "medium",
          title: "No Sozialversicherung deduction found",
          description: `What changed: Your payslip shows gross pay of €${current.gross_pay.toFixed(2)} but no Sozialversicherung (social security) contribution.\n\nWhy it matters: Most employees in Germany pay into Krankenversicherung (KV), Rentenversicherung (RV), Arbeitslosenversicherung (AV) and Pflegeversicherung (PV). Missing contributions affect your healthcare, pension and unemployment cover. In rare cases (e.g. minijob, certain freelancers) it may be correct.\n\nThis may be perfectly valid, but it's worth checking.`,
          suggested_action: "Ask your Personalabteilung (HR) why no Sozialversicherung is being deducted, and confirm your employment status (e.g. Mini-Job vs sozialversicherungspflichtig).",
        });
      }
    } else if (expectsSocialSecurity) {
      if (current.social_security_amount == null || current.social_security_amount === 0) {
        const labelMap: Record<string, { label: string; agency: string }> = {
          france: { label: "cotisations sociales", agency: "Sécurité sociale" },
          spain: { label: "Seguridad Social contribution", agency: "Seguridad Social" },
          italy: { label: "INPS contribution", agency: "INPS" },
          belgium: { label: "ONSS / RSZ contribution", agency: "ONSS / RSZ" },
          portugal: { label: "Segurança Social contribution", agency: "Segurança Social" },
        };
        const info = labelMap[c] ?? { label: "social security contribution", agency: "social security" };
        anomalies.push({
          anomaly_type: "missing_social_security",
          severity: "medium",
          confidence: "medium",
          title: `No ${info.label} found`,
          description: `What changed: Your payslip shows gross pay of €${current.gross_pay.toFixed(2)} but no ${info.label}.\n\nWhy it matters: Most employees pay into ${info.agency} — missing contributions affect your healthcare, pension and unemployment cover. In rare cases (special schemes, exemptions) it may be correct.\n\nThis may be perfectly valid, but it's worth checking.`,
          suggested_action: `Ask your HR / payroll team why no ${info.label} is being deducted and confirm your employment status with ${info.agency}.`,
        });
      }
    } else if (isNetherlands) {
      // Loonheffing already bundles volksverzekeringen — no separate check needed.
    } else {
      if (current.national_insurance_amount == null || current.national_insurance_amount === 0) {
        anomalies.push({
          anomaly_type: "missing_ni",
          severity: "medium",
          confidence: "medium",
          title: "No National Insurance deduction found",
          description: `What changed: Your payslip shows gross pay of ${sym}${current.gross_pay.toFixed(2)} but no National Insurance contribution.\n\nWhy it matters: Most employees earning above the NI threshold pay National Insurance. Missing NI could mean you're below the threshold, have an NI exemption, or your employer hasn't applied the correct NI category. Missing NI payments can affect your State Pension entitlement.\n\nThis may be perfectly valid, but it's worth checking.`,
          suggested_action: "Check the NI category letter on your payslip. If it's missing or shows category X (exempt), confirm with your employer that this is correct. You can also check your NI record at gov.uk.",
        });
      }
    }
  }

  // Deductions reconciliation
  if (current.gross_pay != null && current.net_pay != null && current.total_deductions != null) {
    const expectedNet = current.gross_pay - current.total_deductions;
    const diff = Math.abs(expectedNet - current.net_pay);
    if (diff > 1) {
      anomalies.push({
        anomaly_type: "deductions_mismatch",
        severity: diff > 50 ? "high" : "medium",
        confidence: "medium",
        title: "Deductions don't add up",
        description: `What changed: Your gross pay (${sym}${current.gross_pay.toFixed(2)}) minus total deductions (${sym}${current.total_deductions.toFixed(2)}) should equal your net pay (${sym}${current.net_pay.toFixed(2)}), but there's a ${sym}${diff.toFixed(2)} gap.\n\nWhy it matters: This could mean a deduction is missing from the breakdown, or there's a rounding or processing error. It's worth understanding where the difference comes from.\n\nThis may be perfectly valid, but it's worth checking.`,
        suggested_action: "Review each deduction line on your payslip. If any items seem missing, ask your payroll team to provide a full breakdown of all deductions applied this period.",
      });
    }
  }

  // ─── Comparison checks ───
  if (previous) {
    // Net pay change (5% threshold)
    if (current.net_pay != null && previous.net_pay != null && previous.net_pay > 0) {
      const change = pct(current.net_pay, previous.net_pay);
      if (Math.abs(change) > threshold) {
        const direction = change > 0 ? "increased" : "dropped";
        const absDiff = Math.abs(current.net_pay - previous.net_pay);
        anomalies.push({
          anomaly_type: "net_pay_change",
          severity: Math.abs(change) > 15 ? "high" : "medium",
          confidence: "high",
          title: `Net pay ${direction} noticeably`,
          description: `What changed: Your take-home pay ${direction} from ${sym}${previous.net_pay.toFixed(2)} to ${sym}${current.net_pay.toFixed(2)} — a ${sym}${absDiff.toFixed(2)} difference (${Math.abs(change).toFixed(1)}%).\n\nWhy it matters: ${change < 0 ? "A drop in net pay means less money reaching your account. This could be due to a tax code change, new deduction, or reduced hours." : "An increase is usually positive, but it's good to confirm it matches what you expect — for example, a pay rise, bonus, or reduced deductions."}\n\nHere's what changed and why it may need review.`,
          suggested_action: `Compare this payslip's deductions line by line against last month. Look specifically at tax, ${country === "Ireland" || country === "ireland" ? "PRSI, USC" : "National Insurance"}, and pension contributions to find what shifted.`,
        });
      }
    }

    // Gross pay change (5% threshold)
    if (current.gross_pay != null && previous.gross_pay != null && previous.gross_pay > 0) {
      const change = pct(current.gross_pay, previous.gross_pay);
      if (Math.abs(change) > threshold) {
        const direction = change > 0 ? "increased" : "decreased";
        const absDiff = Math.abs(current.gross_pay - previous.gross_pay);
        const hasBonus = current.bonus_amount != null && current.bonus_amount > 0;
        const hasOvertime = current.overtime_amount != null && current.overtime_amount > 0;
        let context = "";
        if (hasBonus && hasOvertime) context = " This payslip includes both a bonus and overtime, which may explain the change.";
        else if (hasBonus) context = " This payslip includes a bonus payment, which may explain the change.";
        else if (hasOvertime) context = " This payslip includes overtime, which may explain the change.";
        anomalies.push({
          anomaly_type: "gross_pay_change",
          severity: Math.abs(change) > 15 ? "high" : "medium",
          confidence: "high",
          title: `Gross pay ${direction} noticeably`,
          description: `What changed: Your gross pay went from ${sym}${previous.gross_pay.toFixed(2)} to ${sym}${current.gross_pay.toFixed(2)} — a ${sym}${absDiff.toFixed(2)} difference (${Math.abs(change).toFixed(1)}%).${context}\n\nWhy it matters: ${change > 0 ? "An increase could reflect overtime, a bonus, a pay rise, or an error. It's worth confirming the reason." : "A decrease could mean reduced hours, loss of allowances, or a payroll error."}\n\nThis may be perfectly valid, but it's worth checking.`,
          suggested_action: `${hasBonus || hasOvertime ? "Check if the bonus or overtime amount explains the full difference." : "Check whether you had a pay rise, overtime, or any variable pay this period."} If the change is unexpected, ask your payroll team to clarify.`,
        });
      }
    }

    // Same gross, different net
    if (current.gross_pay != null && previous.gross_pay != null && current.net_pay != null && previous.net_pay != null) {
      const grossSame = Math.abs(current.gross_pay - previous.gross_pay) < 5;
      const netDiff = Math.abs(current.net_pay - previous.net_pay);
      if (grossSame && netDiff > 10) {
        const netDir = current.net_pay > previous.net_pay ? "up" : "down";
        anomalies.push({
          anomaly_type: "same_gross_different_net",
          severity: netDiff > 50 ? "high" : "medium",
          confidence: "high",
          title: "Same gross pay but different take-home",
          description: `What changed: Your gross pay is essentially the same, but your take-home pay shifted ${netDir} by ${sym}${netDiff.toFixed(2)}. This means something in your deductions changed.\n\nWhy it matters: When gross pay stays the same but net pay moves, it usually means a deduction was added, removed, or adjusted — such as a tax code change, pension rate update, or new deduction.\n\nHere's what changed and why it may need review.`,
          suggested_action: `Compare each deduction line against last month's payslip. Focus on tax, ${country === "Ireland" || country === "ireland" ? "PRSI, USC" : "National Insurance"}, and pension to identify what shifted.`,
        });
      }
    }

    // Tax disproportionate to gross
    if (current.tax_amount != null && previous.tax_amount != null && current.gross_pay != null && previous.gross_pay != null && previous.tax_amount > 0) {
      const grossChange = pct(current.gross_pay, previous.gross_pay);
      const taxChange = pct(current.tax_amount, previous.tax_amount);
      if (Math.abs(taxChange) > 5 && Math.abs(taxChange) > Math.abs(grossChange) * 2 + 5) {
        const taxDiff = Math.abs(current.tax_amount - previous.tax_amount);
        anomalies.push({
          anomaly_type: "tax_disproportionate",
          severity: Math.abs(taxChange) > 20 ? "high" : "medium",
          confidence: "medium",
          title: "Tax changed more than expected",
          description: `What changed: Your tax went from ${sym}${previous.tax_amount.toFixed(2)} to ${sym}${current.tax_amount.toFixed(2)} (${Math.abs(taxChange).toFixed(1)}% change), while your gross pay only moved by ${Math.abs(grossChange).toFixed(1)}%. That's a ${sym}${taxDiff.toFixed(2)} difference in tax.\n\nWhy it matters: Tax usually moves roughly in line with gross pay. A disproportionate change often signals a tax code update, a one-off adjustment by HMRC, or a cumulative catch-up from a previous month.\n\nThis may be perfectly valid, but it's worth checking.`,
          suggested_action: "Compare the tax code shown on this payslip with last month's. If it's different, check your HMRC online account to confirm it's correct. If it's the same, ask payroll if a tax adjustment was applied.",
        });
      }
    }

    // NI disproportionate to gross
    if (current.national_insurance_amount != null && previous.national_insurance_amount != null && current.gross_pay != null && previous.gross_pay != null && previous.national_insurance_amount > 0) {
      const grossChange = pct(current.gross_pay, previous.gross_pay);
      const niChange = pct(current.national_insurance_amount, previous.national_insurance_amount);
      if (Math.abs(niChange) > 5 && Math.abs(niChange) > Math.abs(grossChange) * 2 + 5) {
        const niDiff = Math.abs(current.national_insurance_amount - previous.national_insurance_amount);
        anomalies.push({
          anomaly_type: "ni_disproportionate",
          severity: "medium",
          confidence: "medium",
          title: "National Insurance changed more than expected",
          description: `What changed: Your NI contributions went from ${sym}${previous.national_insurance_amount.toFixed(2)} to ${sym}${current.national_insurance_amount.toFixed(2)} (${Math.abs(niChange).toFixed(1)}% change), while gross pay only moved by ${Math.abs(grossChange).toFixed(1)}%. That's a ${sym}${niDiff.toFixed(2)} difference.\n\nWhy it matters: NI is calculated as a percentage of earnings above certain thresholds. A disproportionate change could indicate your NI category letter has changed, or that a salary sacrifice arrangement started or stopped.\n\nThis may be perfectly valid, but it's worth checking.`,
          suggested_action: "Check the NI category letter on your payslip (usually A, B, C, etc.). If it changed from last month, ask your payroll team why. You can also verify your NI record on the HMRC website.",
        });
      }
    }

    // Pension material change
    if (current.pension_amount != null && previous.pension_amount != null && previous.pension_amount > 0) {
      const change = pct(current.pension_amount, previous.pension_amount);
      if (Math.abs(change) > 5) {
        const direction = change > 0 ? "increased" : "decreased";
        const diff = Math.abs(current.pension_amount - previous.pension_amount);
        anomalies.push({
          anomaly_type: "pension_change",
          severity: Math.abs(change) > 25 ? "high" : "low",
          confidence: "high",
          title: `Pension contribution ${direction}`,
          description: `What changed: Your pension deduction went from ${sym}${previous.pension_amount.toFixed(2)} to ${sym}${current.pension_amount.toFixed(2)} — a ${sym}${diff.toFixed(2)} difference (${Math.abs(change).toFixed(1)}%).\n\nWhy it matters: Pension contributions can change if your contribution rate was updated, your employer changed their scheme terms, or if salary sacrifice arrangements were adjusted. ${change > 0 ? "A higher contribution means more going into your pension but less take-home pay." : "A lower contribution means more take-home pay but less going into your pension."}\n\nThis may be perfectly valid, but it's worth checking.`,
          suggested_action: "Ask your payroll team whether your pension contribution rate has changed. If you're on salary sacrifice, check if the arrangement was updated.",
        });
      }
    }

    if ((previous.pension_amount == null || previous.pension_amount === 0) && current.pension_amount != null && current.pension_amount > 0) {
      anomalies.push({
        anomaly_type: "new_deduction",
        severity: "medium",
        confidence: "high",
        title: "Pension deduction appeared",
        description: `What changed: A pension deduction of ${sym}${current.pension_amount.toFixed(2)} appeared this month but wasn't on your previous payslip.\n\nWhy it matters: This could mean you've been auto-enrolled into a workplace pension scheme (which is normal and often required by law), or you may have opted in. Either way, it's good to confirm.\n\nThis may be perfectly valid, but it's worth checking.`,
        suggested_action: "Check with your employer whether you've been auto-enrolled into a pension. If so, review the contribution rate and confirm it matches what you agreed to.",
      });
    }
    if (previous.pension_amount != null && previous.pension_amount > 0 && (current.pension_amount == null || current.pension_amount === 0)) {
      anomalies.push({
        anomaly_type: "deduction_disappeared",
        severity: "medium",
        confidence: "high",
        title: "Pension deduction disappeared",
        description: `What changed: A pension deduction of ${sym}${previous.pension_amount.toFixed(2)} was on your previous payslip but is missing from this one.\n\nWhy it matters: If you opted out of your pension, this is expected. But if you didn't, the deduction may have been removed in error — which could affect your retirement savings.\n\nHere's what changed and why it may need review.`,
        suggested_action: "Confirm with your payroll team whether the pension deduction was intentionally removed. If you didn't opt out, ask them to reinstate it.",
      });
    }

    // Student loan appeared/disappeared
    if ((previous.student_loan_amount == null || previous.student_loan_amount === 0) && current.student_loan_amount != null && current.student_loan_amount > 0) {
      anomalies.push({
        anomaly_type: "new_deduction",
        severity: "medium",
        confidence: "high",
        title: "Student loan deduction appeared",
        description: `What changed: A student loan repayment of ${sym}${current.student_loan_amount.toFixed(2)} appeared this month but wasn't on your previous payslip.\n\nWhy it matters: HMRC may have notified your employer to begin deductions. This is normal if you're earning above the repayment threshold, but it's worth confirming the amount and plan type are correct.\n\nThis may be perfectly valid, but it's worth checking.`,
        suggested_action: "Log into your Student Loans Company account to check your repayment plan and threshold. Compare the deduction amount with what you'd expect based on your plan type.",
      });
    }
    if (previous.student_loan_amount != null && previous.student_loan_amount > 0 && (current.student_loan_amount == null || current.student_loan_amount === 0)) {
      anomalies.push({
        anomaly_type: "deduction_disappeared",
        severity: "low",
        confidence: "high",
        title: "Student loan deduction disappeared",
        description: `What changed: A student loan deduction of ${sym}${previous.student_loan_amount.toFixed(2)} was on your previous payslip but is missing from this one.\n\nWhy it matters: If your loan has been fully repaid, this is expected and good news. However, if it hasn't, repayments may have stopped in error, which could lead to a larger deduction later to catch up.\n\nThis may be perfectly valid, but it's worth checking.`,
        suggested_action: "Check your Student Loans Company account to see if your loan is marked as repaid. If it's not, ask your payroll team why the deduction was removed.",
      });
    }

    if (current.total_deductions != null && previous.total_deductions != null && previous.total_deductions > 0) {
      const change = pct(current.total_deductions, previous.total_deductions);
      if (Math.abs(change) > 10) {
        const direction = change > 0 ? "increased" : "decreased";
        const dedDiff = Math.abs(current.total_deductions - previous.total_deductions);
        anomalies.push({
          anomaly_type: "total_deductions_change",
          severity: Math.abs(change) > 25 ? "high" : "medium",
          confidence: "high",
          title: `Total deductions ${direction} materially`,
          description: `What changed: Your total deductions went from ${sym}${previous.total_deductions.toFixed(2)} to ${sym}${current.total_deductions.toFixed(2)} — a ${sym}${dedDiff.toFixed(2)} difference (${Math.abs(change).toFixed(1)}%).\n\nWhy it matters: ${direction === "increased" ? "Higher deductions mean less take-home pay. This could be due to tax, NI, pension, or a new deduction being added." : "Lower deductions could mean a deduction was removed or reduced. Make sure nothing important (like pension) was accidentally dropped."}\n\nHere's what changed and why it may need review.`,
          suggested_action: "Go through each deduction line on this payslip and compare it to last month. Identify which specific item(s) changed and whether the change was expected.",
        });
      }
    }

    // ─── Ireland-specific ───
    if (country === "Ireland" || country === "ireland") {
      if (current.prsi_amount != null && previous.prsi_amount != null && previous.prsi_amount > 0 && current.gross_pay != null && previous.gross_pay != null) {
        const grossChange = pct(current.gross_pay, previous.gross_pay);
        const prsiChange = pct(current.prsi_amount, previous.prsi_amount);
        if (Math.abs(prsiChange) > 5 && Math.abs(prsiChange) > Math.abs(grossChange) * 2 + 5) {
          const prsiDiff = Math.abs(current.prsi_amount - previous.prsi_amount);
          anomalies.push({
            anomaly_type: "prsi_disproportionate",
            severity: "medium",
            confidence: "medium",
            title: "PRSI changed more than expected",
            description: `What changed: Your PRSI went from €${previous.prsi_amount.toFixed(2)} to €${current.prsi_amount.toFixed(2)} (${Math.abs(prsiChange).toFixed(1)}% change), while gross pay only moved by ${Math.abs(grossChange).toFixed(1)}%. That's a €${prsiDiff.toFixed(2)} difference.\n\nWhy it matters: PRSI is normally a fixed percentage based on your PRSI class. A disproportionate change could mean your class changed, or there was an adjustment by Revenue.\n\nThis may be perfectly valid, but it's worth checking.`,
            suggested_action: "Check your PRSI class on this payslip and compare it to the previous one. If it changed, confirm with your employer or Revenue why.",
          });
        }
      }

      if (current.usc_amount != null && previous.usc_amount != null && previous.usc_amount > 0 && current.gross_pay != null && previous.gross_pay != null) {
        const grossChange = pct(current.gross_pay, previous.gross_pay);
        const uscChange = pct(current.usc_amount, previous.usc_amount);
        if (Math.abs(uscChange) > 5 && Math.abs(uscChange) > Math.abs(grossChange) * 2 + 5) {
          const uscDiff = Math.abs(current.usc_amount - previous.usc_amount);
          anomalies.push({
            anomaly_type: "usc_disproportionate",
            severity: "medium",
            confidence: "medium",
            title: "USC changed more than expected",
            description: `What changed: Your USC went from €${previous.usc_amount.toFixed(2)} to €${current.usc_amount.toFixed(2)} (${Math.abs(uscChange).toFixed(1)}% change), while gross pay only moved by ${Math.abs(grossChange).toFixed(1)}%. That's a €${uscDiff.toFixed(2)} difference.\n\nWhy it matters: USC is calculated in bands based on your income. A disproportionate change could mean your rate bands shifted, you crossed a threshold, or an exemption status changed.\n\nThis may be perfectly valid, but it's worth checking.`,
            suggested_action: "Check your Revenue online account to confirm your USC rate bands and exemption status. If the rate seems wrong, raise it with your payroll team.",
          });
        }
      }
    }
  }

  return anomalies;
}

// ---------- Main handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let claimedProcessing: { supabase: SupabaseClient; userId: string; payslipId: string; processingToken: string } | null = null;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Authenticate the caller
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await authClient.auth.getUser(authHeader);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestBody: unknown = await req.json().catch(() => null);
    const payslipId = isPlainObject(requestBody) ? requestBody.payslip_id : null;
    if (!isUuid(payslipId)) {
      return new Response(
        JSON.stringify({ error: "A valid payslip_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the row once and bind the privileged storage operation to the
    // caller's UUID-prefixed object key, rather than relying on key secrecy.
    const { data: initialPayslip, error: payslipErr } = await supabase
      .from("payslips")
      .select("id, user_id, file_path, file_name, country, status, processing_attempts, processing_started_at, cleanup_requested_at")
      .eq("id", payslipId)
      .single();

    if (payslipErr || !initialPayslip) {
      return new Response(
        JSON.stringify({ error: "Payslip not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (initialPayslip.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payslip = initialPayslip;

    if (payslip.status === "failed" && (payslip.processing_attempts ?? 0) >= MAX_PROCESSING_ATTEMPTS) {
      return new Response(
        JSON.stringify({ error: "This payslip could not be processed after several attempts. Please upload a clearer file or enter the details manually." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (payslip.cleanup_requested_at) {
      return new Response(
        JSON.stringify({ error: "This unfinished upload is already being removed." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (payslip.status !== "processing" && payslip.status !== "failed") {
      return new Response(
        JSON.stringify({ error: "This payslip has already been processed." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Processing a private financial document is rate-limited per authenticated
    // account. We intentionally do not trust a caller-controlled forwarded IP.
    const userLimit = await checkRateLimit({
      bucketKey: `process-payslip:user:${user.id}`,
      maxPerWindow: 10,
      windowSeconds: 3600,
      client: supabase,
    });
    if (!userLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many automatic checks. Please try again later." }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(userLimit.retryAfterSeconds),
          },
        }
      );
    }
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Payslip checking is not configured yet. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const configuredStripeEnvironment = Deno.env.get("PAYCHECK_STRIPE_ENV");
    if (configuredStripeEnvironment !== "sandbox" && configuredStripeEnvironment !== "live") {
      return new Response(
        JSON.stringify({ error: "Payslip checks are not configured yet. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Only change a retryable failure back to processing after the rate limit
    // and provider configuration have been checked. An outage must leave the
    // record visibly retryable rather than strand it in an unclaimed state.
    const retriedFromFailure = payslip.status === "failed";
    if (retriedFromFailure) {
      const { data: retryPayslip, error: retryError } = await supabase
        .from("payslips")
        .update({
          status: "processing",
          processing_started_at: null,
          processing_finished_at: null,
          processing_failure_code: null,
          processing_token: null,
          provider_started_at: null,
        })
        .eq("id", payslipId)
        .eq("user_id", user.id)
        .eq("status", "failed")
        .lt("processing_attempts", MAX_PROCESSING_ATTEMPTS)
        .is("cleanup_requested_at", null)
        .select("id, user_id, file_path, file_name, country, status, processing_attempts, processing_started_at, cleanup_requested_at")
        .maybeSingle();

      if (retryError || !retryPayslip) {
        return new Response(
          JSON.stringify({ error: "This payslip is already being processed or cannot be retried." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      payslip = retryPayslip;
    }

    // This RPC is the only paid/free claim path. It locks the account's
    // calendar-month allowance, reserves every automatic check, creates a
    // fencing token, and prepares extraction state before any private document
    // reaches the provider.
    const { data: claimResult, error: claimError } = await supabase.rpc("reserve_and_claim_secure_payslip_processing", {
      p_payslip_id: payslipId,
      p_user_id: user.id,
      p_environment: configuredStripeEnvironment,
    });
    if (claimError) {
      return new Response(
        JSON.stringify({ error: "We could not start the secure payslip check. Please try again." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const claim = isPlainObject(claimResult) ? claimResult : null;
    const claimStatus = typeof claim?.status === "string" ? claim.status : null;
    const claimTier = typeof claim?.tier === "string" ? claim.tier : "free";
    const claimMonthlyLimit = typeof claim?.monthly_limit === "number" && Number.isInteger(claim.monthly_limit)
      ? claim.monthly_limit
      : null;
    const processingToken = typeof claim?.processing_token === "string" && isUuid(claim.processing_token)
      ? claim.processing_token
      : null;
    if (claimStatus === "account_deletion_pending") {
      // If a retry switched a failed row back to processing immediately before
      // the durable lifecycle fence won, restore a retryable terminal state.
      // No processing token/provider dispatch exists on this branch.
      if (retriedFromFailure) {
        await supabase
          .from("payslips")
          .update({
            status: "failed",
            processing_finished_at: new Date().toISOString(),
            processing_failure_code: "account_deletion_pending",
          })
          .eq("id", payslipId)
          .eq("user_id", user.id)
          .eq("status", "processing")
          .is("processing_token", null);
      }
      return new Response(
        JSON.stringify({ error: "Your account deletion is being safely completed, so this payslip check cannot continue." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (claimStatus === "quota_exceeded") {
      const paidTier = claimTier === "plus" || claimTier === "lifetime";
      const limitLabel = claimMonthlyLimit ? `${claimMonthlyLimit} automatic checks` : "automatic-check";
      return new Response(
        JSON.stringify({
          error: paidTier
            ? `Your ${limitLabel} limit for this calendar month has been reached. It resets at the start of the next Ireland calendar month.`
            : `Your Free plan ${limitLabel} limit for this calendar month has been reached. Upgrade for up to 6 automatic checks per calendar month.`,
          code: "monthly_automatic_check_limit_reached",
        }),
        {
          status: paidTier ? 429 : 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (claimStatus === "attempt_limit") {
      return new Response(
        JSON.stringify({ error: "This payslip could not be processed after several attempts. Please upload a clearer file or enter the details manually." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (claimStatus === "stalled_after_dispatch") {
      return new Response(
        JSON.stringify({ error: "That automatic check took longer than expected. Open the saved payslip to add the figures yourself or choose an explicit retry." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (claimStatus !== "claimed" || !processingToken) {
      return new Response(
        JSON.stringify({ error: "This payslip is already being processed or has already been completed." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    claimedProcessing = { supabase, userId: user.id, payslipId, processingToken };

    if (!isOwnedPayslipObjectPath(payslip.file_path, user.id)) {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "invalid_storage_path", true);
      return new Response(
        JSON.stringify({ error: "This payslip file cannot be processed securely. Please upload it again." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Download the file from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("payslips")
      .download(payslip.file_path);

    if (downloadErr || !fileData) {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "storage_download_failed", true);

      return new Response(
        JSON.stringify({ error: "We could not read that file. Please upload it again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (fileData.size > PAYSLIP_MAX_FILE_BYTES) {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "file_too_large", true);
      return new Response(
        JSON.stringify({ error: "That file is over the 10 MB limit. Please upload a smaller file." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let fileBytes: ArrayBuffer;
    try {
      fileBytes = await fileData.arrayBuffer();
    } catch {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "file_read_failed", true);
      return new Response(
        JSON.stringify({ error: "We could not read that file. Please upload it again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // The filename and browser-provided MIME type are untrusted. Derive the
    // data-URL type from the exact bytes fetched from the authenticated user's
    // storage namespace before the document can reach any external provider.
    const mimeType = detectPayslipMimeType(new Uint8Array(fileBytes));
    if (!mimeType) {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "invalid_file_signature", true);
      return new Response(
        JSON.stringify({ error: "Please upload a PDF, PNG, JPG, or WebP payslip." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Construct the only permitted provider payload before recording a
    // dispatch. The builder accepts only verified bytes and MIME, and never
    // receives customer metadata such as an ID, filename or storage path.
    const providerDispatch = buildPayslipExtractionProviderRequest({
      apiKey: LOVABLE_API_KEY,
      mimeType,
      fileBytes,
    });
    if (!providerDispatch) {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "file_encode_failed", true);
      return new Response(
        JSON.stringify({ error: "We could not prepare that file for checking. Please upload it again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!await markProviderStarted(supabase, user.id, payslipId, processingToken)) {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "provider_dispatch_not_started", true);
      return new Response(
        JSON.stringify({ error: "This payslip check changed before it could start. Refresh and try again." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Call Gemini via Lovable AI gateway. A timeout is treated as a
    // dispatched failure: delivery is uncertain after provider_started_at, so
    // the existing quota reservation is intentionally retained.
    const providerRequest = await fetchProviderJsonWithTimeout(
      fetch,
      providerDispatch.endpoint,
      providerDispatch.init,
      PROVIDER_REQUEST_TIMEOUT_MS,
    );

    if (!providerRequest.ok) {
      const failureCode = providerRequest.reason === "timeout"
        ? "provider_request_timed_out"
        : providerRequest.reason === "invalid_response"
          ? "provider_invalid_response"
          : "provider_network_error";
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, failureCode);
      console.error("[process-payslip] extraction provider request did not complete", {
        reason: providerRequest.reason,
      });
      return new Response(
        JSON.stringify({ error: "We could not check that payslip right now. Please try again." }),
        { status: providerRequest.reason === "timeout" ? 504 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResponse = providerRequest.response;

    if (!aiResponse.ok) {
      console.error("[process-payslip] extraction provider request failed", { status: aiResponse.status });

      if (aiResponse.status === 429) {
        await markProcessingFailed(supabase, user.id, payslipId, processingToken, "provider_rate_limited");
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        await markProcessingFailed(supabase, user.id, payslipId, processingToken, "provider_credits_unavailable");
        return new Response(
          JSON.stringify({ error: "Payslip checks are temporarily unavailable. Please try again later." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "provider_request_failed");

      return new Response(
        JSON.stringify({ error: "We could not check that payslip right now. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = providerRequest.data;

    const rawContent = assistantContent(aiData);
    if (!rawContent) {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "provider_missing_content");
      return new Response(
        JSON.stringify({ error: "We could not read the payslip check result. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse a strictly bounded data object. Never log or persist unvalidated
    // provider content: it can contain a full transcription of a payslip.
    let extractionCandidate: unknown;
    try {
      const jsonStr = rawContent
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      extractionCandidate = JSON.parse(jsonStr);
    } catch {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "provider_invalid_json");

      return new Response(
        JSON.stringify({ error: "We could not read the payslip check result. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = parseExtraction(extractionCandidate);
    if (!extracted) {
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "provider_invalid_schema");
      return new Response(
        JSON.stringify({ error: "We could not safely read the payslip result. Please upload a clearer file or enter the details manually." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 5. Save extraction
    const confidenceMap: Record<string, number> = {
      high: 0.9,
      medium: 0.7,
      low: 0.4,
    };

    const { data: updatedExtractions, error: updateExtErr } = await supabase
      .from("payslip_extractions")
      .update({
        extraction_status: "completed",
        confidence_score: confidenceMap[extracted.confidence],
        gross_pay: extracted.gross_pay,
        net_pay: extracted.net_pay,
        taxable_pay: extracted.taxable_pay,
        tax_amount: extracted.tax_amount,
        national_insurance_amount: extracted.national_insurance_amount,
        prsi_amount: extracted.prsi_amount,
        usc_amount: extracted.usc_amount,
        social_security_amount: extracted.social_security_amount,
        solidarity_amount: extracted.solidarity_amount,
        church_tax_amount: extracted.church_tax_amount,
        pension_amount: extracted.pension_amount,
        student_loan_amount: extracted.student_loan_amount,
        bonus_amount: extracted.bonus_amount,
        overtime_amount: extracted.overtime_amount,
        total_deductions: extracted.total_deductions,
        year_to_date_json: extracted.year_to_date,
        raw_extraction_json: null,
        normalized_json: extracted,
      })
      .eq("payslip_id", payslipId)
      .eq("processing_token", processingToken)
      .select("id");

    if (updateExtErr || !updatedExtractions?.length) {
      console.error("[process-payslip] extraction record update failed", { code: updateExtErr?.code ?? null });
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "extraction_record_update_failed");
      return new Response(
        JSON.stringify({ error: "This payslip check changed before the result could be saved. Refresh and try again." }),
        { status: updateExtErr ? 500 : 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Every extraction stays in review until its owner confirms the key figures.
    // A high-confidence provider result is useful input, not a verified payslip.
    const normPayDate = normaliseDate(extracted.pay_date);
    const normPeriodStart = normaliseDate(extracted.pay_period_start);
    const normPeriodEnd = normaliseDate(extracted.pay_period_end);

    // The extraction parser accepts only UK/Ireland. Re-validate the existing
    // row value too, so a legacy or malformed value cannot be written back.
    const country = extracted.country ?? nullableCountry(payslip.country) ?? null;

    const { data: updatedPayslip, error: updatePayslipError } = await supabase
      .from("payslips")
      .update({
        status: "needs_review",
        pay_date: normPayDate,
        pay_period_start: normPeriodStart,
        pay_period_end: normPeriodEnd,
        country,
        processing_finished_at: new Date().toISOString(),
        processing_failure_code: null,
        processing_token: null,
      })
      .eq("id", payslipId)
      .eq("user_id", user.id)
      .eq("status", "processing")
      .eq("processing_token", processingToken)
      .select("id")
      .maybeSingle();

    if (updatePayslipError || !updatedPayslip) {
      console.error("[process-payslip] payslip state update failed", { code: updatePayslipError?.code ?? null });
      await markProcessingFailed(supabase, user.id, payslipId, processingToken, "payslip_state_update_failed");
      return new Response(
        JSON.stringify({ error: "This payslip check changed before the result could be saved. Refresh and try again." }),
        { status: updatePayslipError ? 500 : 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // The durable extraction and user-visible status are saved. Later
    // best-effort anomaly work must not convert a completed payslip to failed.
    claimedProcessing = null;

    // 6. Get previous payslip extraction for anomaly comparison
    // Include any payslip that has been processed (completed or needs_review)
    const { data: prevPayslips } = await supabase
      .from("payslips")
      .select("id")
      .eq("user_id", payslip.user_id)
      .neq("id", payslipId)
      .in("status", ["completed", "needs_review"])
      .order("pay_date", { ascending: false, nullsFirst: false })
      .limit(1);

    // If no previous by pay_date, try by created_at
    let prevId: string | null = prevPayslips?.[0]?.id ?? null;
    if (!prevId) {
      const { data: prevByCreated } = await supabase
        .from("payslips")
        .select("id")
        .eq("user_id", payslip.user_id)
        .neq("id", payslipId)
        .neq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1);
      prevId = prevByCreated?.[0]?.id ?? null;
    }

    let previousExtraction: Extraction | null = null;
    if (prevId) {
      const { data: prevExt } = await supabase
        .from("payslip_extractions")
        .select("*")
        .eq("payslip_id", prevId)
        .eq("extraction_status", "completed")
        .single();

      if (prevExt) {
        previousExtraction = prevExt as unknown as Extraction;
      }
    }

    // 7. Run anomaly detection
    const currentExtraction: Extraction = {
      gross_pay: extracted.gross_pay,
      net_pay: extracted.net_pay,
      taxable_pay: extracted.taxable_pay,
      tax_amount: extracted.tax_amount,
      national_insurance_amount: extracted.national_insurance_amount,
      prsi_amount: extracted.prsi_amount,
      usc_amount: extracted.usc_amount,
      social_security_amount: extracted.social_security_amount,
      solidarity_amount: extracted.solidarity_amount,
      church_tax_amount: extracted.church_tax_amount,
      pension_amount: extracted.pension_amount,
      student_loan_amount: extracted.student_loan_amount,
      bonus_amount: extracted.bonus_amount,
      overtime_amount: extracted.overtime_amount,
      total_deductions: extracted.total_deductions,
    };

    // Load user's anomaly threshold from their profile (defaults to 5%)
    const { data: profile } = await supabase
      .from("profiles")
      .select("anomaly_threshold_percent")
      .eq("user_id", payslip.user_id)
      .maybeSingle();
    const threshold = profile?.anomaly_threshold_percent != null
      ? Number(profile.anomaly_threshold_percent)
      : 5;

    const anomalies = runAnomalyChecks(
      currentExtraction,
      previousExtraction,
      country,
      threshold
    );

    // 8. Save anomalies
    if (anomalies.length > 0) {
      const anomalyRows = anomalies.map((a) => ({
        payslip_id: payslipId,
        anomaly_type: a.anomaly_type,
        severity: a.severity,
        confidence: a.confidence,
        title: a.title,
        description: a.description,
        suggested_action: a.suggested_action,
        status: "new",
      }));

      await supabase.from("anomaly_results").insert(anomalyRows);
    }

    return new Response(
      JSON.stringify({
        success: true,
        extraction: extracted,
        anomalies_found: anomalies.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    if (claimedProcessing) {
      await markProcessingFailed(
        claimedProcessing.supabase,
        claimedProcessing.userId,
        claimedProcessing.payslipId,
        claimedProcessing.processingToken,
        "unexpected_processing_error",
      );
    }
    console.error("[process-payslip] unexpected failure", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
