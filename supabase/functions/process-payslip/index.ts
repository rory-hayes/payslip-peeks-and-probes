import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

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
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let [, dd, mm, yy] = dmy;
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
};

// ---------- Extraction prompt ----------

const EXTRACTION_PROMPT = `You are a payslip data extraction assistant. Analyze this payslip document and extract all financial data.

Return a JSON object using this exact schema (use null for fields you cannot find):

{
  "pay_date": "YYYY-MM-DD or null",
  "pay_period_start": "YYYY-MM-DD or null",
  "pay_period_end": "YYYY-MM-DD or null",
  "employer_name": "string or null",
  "country": "UK or Ireland or Germany or France or Netherlands or Spain or Italy or Belgium or Portugal or null",
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
  "confidence": "high" | "medium" | "low",
  "notes": "any extraction notes"
}

Country detection:
- If PRSI or USC are present, country is Ireland
- If "National Insurance" / "NI" / "PAYE" with £ is present, country is UK
- If German terms appear (Brutto, Netto, Lohnsteuer, Solidaritätszuschlag, Sozialversicherung, Steuerklasse, Krankenversicherung, Rentenversicherung, Pflegeversicherung, Arbeitslosenversicherung), country is Germany
- If French terms appear (Bulletin de paie, Salaire brut, Net à payer, Prélèvement à la source, CSG, CRDS, Sécurité sociale, AGIRC-ARRCO), country is France
- If Dutch terms appear (Loonstrook, Salarisstrook, Brutoloon, Nettoloon, Loonheffing, Loonbelasting, Heffingskorting, Vakantiegeld, AOW, WLZ), country is Netherlands
- If Spanish terms appear (Nómina, Recibo de salarios, Salario bruto, IRPF, Seguridad Social, Contingencias comunes, Líquido a percibir), country is Spain
- If Italian terms appear (Busta paga, Cedolino, Retribuzione lorda, IRPEF, INPS, TFR, Addizionale regionale), country is Italy
- If Belgian terms appear (Fiche de paie, Loonfiche, Précompte professionnel, Bedrijfsvoorheffing, ONSS, RSZ, Pécule de vacances), country is Belgium
- If Portuguese terms appear (Recibo de vencimento, Vencimento bruto, IRS, Retenção na fonte, Segurança Social, Subsídio de férias), country is Portugal

Field mapping for Germany:
- "Brutto" / "Bruttobezüge" → gross_pay
- "Netto" / "Auszahlungsbetrag" → net_pay
- "Lohnsteuer" → tax_amount
- "Solidaritätszuschlag" / "Soli" → solidarity_amount
- "Kirchensteuer" / "KiSt" → church_tax_amount
- Sum of "Krankenversicherung (KV) + Rentenversicherung (RV) + Arbeitslosenversicherung (AV) + Pflegeversicherung (PV)" employee shares → social_security_amount
- "Betriebsrente" / "Gehaltsumwandlung" / pension contributions → pension_amount

Field mapping for France:
- "Salaire brut" / "Total brut" → gross_pay
- "Net à payer" / "Salaire net" → net_pay
- "Prélèvement à la source" / "PAS" / "Impôt sur le revenu" → tax_amount
- Sum of "CSG + CRDS + Sécurité sociale + AGIRC-ARRCO + Chômage + Assurance maladie" employee shares (cotisations salariales) → social_security_amount
- "Retraite complémentaire" or supplementary pension → pension_amount

Field mapping for Netherlands:
- "Brutoloon" / "Bruto salaris" → gross_pay
- "Nettoloon" / "Netto salaris" / "Uit te betalen" → net_pay
- "Loonheffing" / "Loonbelasting" → tax_amount (this already includes premies volksverzekeringen)
- "Pensioenpremie" / pension contributions → pension_amount
- Dutch payslips typically do NOT show separate social security (it's bundled into Loonheffing) — leave social_security_amount as null

Field mapping for Spain:
- "Salario bruto" / "Total devengado" → gross_pay
- "Líquido a percibir" / "Salario neto" → net_pay
- "Retención IRPF" / "IRPF" → tax_amount
- Sum of "Contingencias comunes + Desempleo + Formación profesional + MEI" employee shares → social_security_amount
- "Plan de pensiones" → pension_amount

Field mapping for Italy:
- "Retribuzione lorda" / "Imponibile" → gross_pay
- "Netto a pagare" / "Retribuzione netta" → net_pay
- "IRPEF" + "Addizionale regionale" + "Addizionale comunale" combined → tax_amount
- "Contributi INPS" / "Contributo IVS" employee share → social_security_amount
- "Previdenza complementare" → pension_amount

Field mapping for Belgium:
- "Salaire brut" / "Brutto loon" → gross_pay
- "Salaire net" / "Netto loon" → net_pay
- "Précompte professionnel" / "Bedrijfsvoorheffing" → tax_amount
- "ONSS" / "RSZ" employee share → social_security_amount
- "Pension complémentaire" / "Aanvullend pensioen" → pension_amount

Field mapping for Portugal:
- "Vencimento bruto" / "Total ilíquido" → gross_pay
- "Líquido a receber" / "Vencimento líquido" → net_pay
- "Retenção na fonte" / "IRS" → tax_amount
- "Segurança Social" / "TSU" employee share → social_security_amount
- "PPR" / pension contributions → pension_amount

Rules:
- All monetary values should be plain numbers (no currency symbols, no thousand separators)
- Use the EMPLOYEE share, NOT the employer share
- For European payslips (DE/FR/NL/ES/IT/BE/PT), the decimal separator on the document is often a comma — convert to a dot in the output
- Be precise with decimal values
- Only return the JSON object, no other text`;

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

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    const { payslip_id } = await req.json();
    if (!payslip_id) {
      return new Response(
        JSON.stringify({ error: "payslip_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the caller owns this payslip
    const { data: payslipOwner } = await supabase
      .from("payslips")
      .select("user_id")
      .eq("id", payslip_id)
      .single();

    if (!payslipOwner || payslipOwner.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side free-tier upload quota enforcement
    const FREE_UPLOAD_LIMIT = 3;
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const { data: activeSub } = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "canceled"])
      .order("created_at", { ascending: false });

    const now = new Date().toISOString();
    const hasActiveSub = (activeSub ?? []).some((s) =>
      (s.status === "active" || s.status === "trialing") ||
      (s.status === "canceled" && s.current_period_end && s.current_period_end > now)
    );

    if (!hasActiveSub) {
      const { count: monthlyUploads } = await supabase
        .from("payslips")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth.toISOString());

      if ((monthlyUploads ?? 0) > FREE_UPLOAD_LIMIT) {
        return new Response(
          JSON.stringify({ error: "Monthly upload limit reached. Upgrade to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const userKey = user.id;
    const ipKey = getClientIp(req);

    // Two-tier rate limit: 10 uploads/user/hour, 30 uploads/IP/hour.
    const userLimit = await checkRateLimit({
      bucketKey: `process-payslip:user:${userKey}`,
      maxPerWindow: 10,
      windowSeconds: 3600,
      client: supabase,
    });
    if (!userLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many uploads. Please try again later." }),
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
    const ipLimit = await checkRateLimit({
      bucketKey: `process-payslip:ip:${ipKey}`,
      maxPerWindow: 30,
      windowSeconds: 3600,
      client: supabase,
    });
    if (!ipLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests from this network. Please try again later." }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(ipLimit.retryAfterSeconds),
          },
        }
      );
    }

    // 1. Get payslip record
    const { data: payslip, error: payslipErr } = await supabase
      .from("payslips")
      .select("*")
      .eq("id", payslip_id)
      .single();

    if (payslipErr || !payslip) {
      return new Response(
        JSON.stringify({ error: "Payslip not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Download the file from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("payslips")
      .download(payslip.file_path);

    if (downloadErr || !fileData) {
      await supabase
        .from("payslip_extractions")
        .update({ extraction_status: "failed" })
        .eq("payslip_id", payslip_id);

      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Convert file to base64
    const arrayBuf = await fileData.arrayBuffer();
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuf))
    );

    const mimeType = payslip.file_name?.endsWith(".pdf")
      ? "application/pdf"
      : payslip.file_name?.match(/\.(png)$/i)
        ? "image/png"
        : payslip.file_name?.match(/\.(jpe?g)$/i)
          ? "image/jpeg"
          : "image/webp";

    // 4. Call Gemini via Lovable AI gateway
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: EXTRACTION_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
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
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("payslip_extractions")
        .update({ extraction_status: "failed" })
        .eq("payslip_id", payslip_id);

      return new Response(
        JSON.stringify({ error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from the AI response (strip markdown fences if present)
    let extracted: Record<string, unknown>;
    try {
      const jsonStr = rawContent
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI JSON:", rawContent);
      await supabase
        .from("payslip_extractions")
        .update({
          extraction_status: "failed",
          raw_extraction_json: { raw: rawContent },
        })
        .eq("payslip_id", payslip_id);

      return new Response(
        JSON.stringify({ error: "Failed to parse extraction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Save extraction
    const confidenceMap: Record<string, number> = {
      high: 0.9,
      medium: 0.7,
      low: 0.4,
    };

    const { error: updateExtErr } = await supabase
      .from("payslip_extractions")
      .update({
        extraction_status: "completed",
        confidence_score:
          confidenceMap[(extracted.confidence as string) || "medium"] || 0.7,
        gross_pay: extracted.gross_pay as number | null,
        net_pay: extracted.net_pay as number | null,
        taxable_pay: extracted.taxable_pay as number | null,
        tax_amount: extracted.tax_amount as number | null,
        national_insurance_amount:
          extracted.national_insurance_amount as number | null,
        prsi_amount: extracted.prsi_amount as number | null,
        usc_amount: extracted.usc_amount as number | null,
        social_security_amount: extracted.social_security_amount as number | null,
        solidarity_amount: extracted.solidarity_amount as number | null,
        church_tax_amount: extracted.church_tax_amount as number | null,
        pension_amount: extracted.pension_amount as number | null,
        student_loan_amount: extracted.student_loan_amount as number | null,
        bonus_amount: extracted.bonus_amount as number | null,
        overtime_amount: extracted.overtime_amount as number | null,
        total_deductions: extracted.total_deductions as number | null,
        year_to_date_json: extracted.year_to_date || null,
        raw_extraction_json: extracted,
        normalized_json: extracted,
      })
      .eq("payslip_id", payslip_id);

    if (updateExtErr) {
      console.error("DB update error:", updateExtErr);
    }

    // Determine if review is needed
    const normPayDate = normaliseDate(extracted.pay_date as string);
    const normPeriodStart = normaliseDate(extracted.pay_period_start as string);
    const normPeriodEnd = normaliseDate(extracted.pay_period_end as string);
    const grossPay = extracted.gross_pay as number | null;
    const netPay = extracted.net_pay as number | null;

    const needsReview =
      !normPayDate ||
      grossPay == null ||
      netPay == null ||
      (netPay != null && grossPay != null && netPay > grossPay) ||
      (extracted.confidence as string) === "low";

    await supabase
      .from("payslips")
      .update({
        status: needsReview ? "needs_review" : "completed",
        pay_date: normPayDate,
        pay_period_start: normPeriodStart,
        pay_period_end: normPeriodEnd,
        country: extracted.country || payslip.country,
      })
      .eq("id", payslip_id);

    // 6. Get previous payslip extraction for anomaly comparison
    // Include any payslip that has been processed (completed or needs_review)
    const { data: prevPayslips } = await supabase
      .from("payslips")
      .select("id")
      .eq("user_id", payslip.user_id)
      .neq("id", payslip_id)
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
        .neq("id", payslip_id)
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
      gross_pay: extracted.gross_pay as number | null,
      net_pay: extracted.net_pay as number | null,
      taxable_pay: extracted.taxable_pay as number | null,
      tax_amount: extracted.tax_amount as number | null,
      national_insurance_amount:
        extracted.national_insurance_amount as number | null,
      prsi_amount: extracted.prsi_amount as number | null,
      usc_amount: extracted.usc_amount as number | null,
      social_security_amount: extracted.social_security_amount as number | null,
      solidarity_amount: extracted.solidarity_amount as number | null,
      church_tax_amount: extracted.church_tax_amount as number | null,
      pension_amount: extracted.pension_amount as number | null,
      student_loan_amount: extracted.student_loan_amount as number | null,
      bonus_amount: extracted.bonus_amount as number | null,
      overtime_amount: extracted.overtime_amount as number | null,
      total_deductions: extracted.total_deductions as number | null,
    };

    const country =
      (extracted.country as string) || payslip.country || null;

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
        payslip_id,
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
  } catch (e) {
    console.error("[process-payslip] error:", e);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
