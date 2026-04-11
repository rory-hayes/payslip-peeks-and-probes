import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  "country": "UK or Ireland or null",
  "gross_pay": number or null,
  "net_pay": number or null,
  "taxable_pay": number or null,
  "tax_amount": number or null,
  "national_insurance_amount": number or null,
  "prsi_amount": number or null,
  "usc_amount": number or null,
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

Rules:
- All monetary values should be plain numbers (no currency symbols)
- If PRSI or USC are present, country is likely Ireland
- If National Insurance is present, country is likely UK
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
  country: string | null
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // --- Universal checks ---

  if (current.gross_pay == null || current.net_pay == null) {
    anomalies.push({
      anomaly_type: "missing_key_fields",
      severity: "high",
      confidence: "high",
      title: "Missing key pay fields",
      description:
        "We couldn't find gross pay or net pay on this payslip. This may indicate an extraction issue.",
      suggested_action:
        "Check the original payslip and manually confirm the values.",
    });
  }

  if (
    current.net_pay != null &&
    current.gross_pay != null &&
    current.net_pay > current.gross_pay
  ) {
    anomalies.push({
      anomaly_type: "net_exceeds_gross",
      severity: "high",
      confidence: "high",
      title: "Net pay exceeds gross pay",
      description:
        "Your net pay is higher than your gross pay, which is unusual unless you have refunds or back-pay adjustments.",
      suggested_action: "Check with payroll — this may be an error.",
    });
  }

  if (current.net_pay != null && current.net_pay < 0) {
    anomalies.push({
      anomaly_type: "negative_value",
      severity: "high",
      confidence: "high",
      title: "Negative net pay",
      description: "Your net pay is negative, which is extremely unusual.",
      suggested_action:
        "Contact payroll immediately to understand this result.",
    });
  }

  // Deductions reconciliation
  if (
    current.gross_pay != null &&
    current.net_pay != null &&
    current.total_deductions != null
  ) {
    const expectedNet = current.gross_pay - current.total_deductions;
    const diff = Math.abs(expectedNet - current.net_pay);
    if (diff > 1) {
      anomalies.push({
        anomaly_type: "deductions_mismatch",
        severity: "medium",
        confidence: "medium",
        title: "Deductions don't add up",
        description: `Gross pay minus total deductions should equal net pay, but there's a £${diff.toFixed(2)} difference.`,
        suggested_action:
          "Check if all deductions are shown — there may be hidden items.",
      });
    }
  }

  // --- Comparison checks (if we have a previous payslip) ---
  if (previous) {
    // Net pay change
    if (current.net_pay != null && previous.net_pay != null) {
      const pctChange =
        ((current.net_pay - previous.net_pay) / previous.net_pay) * 100;
      if (Math.abs(pctChange) > 10) {
        const direction = pctChange > 0 ? "increased" : "decreased";
        anomalies.push({
          anomaly_type: "net_pay_change",
          severity: Math.abs(pctChange) > 20 ? "high" : "medium",
          confidence: "high",
          title: `Net pay ${direction} by ${Math.abs(pctChange).toFixed(1)}%`,
          description: `Your net pay changed from £${previous.net_pay.toFixed(2)} to £${current.net_pay.toFixed(2)}. This is a significant shift.`,
          suggested_action:
            "Review what changed — check tax, NI, pension, or new deductions.",
        });
      }
    }

    // Gross pay change
    if (current.gross_pay != null && previous.gross_pay != null) {
      const pctChange =
        ((current.gross_pay - previous.gross_pay) / previous.gross_pay) * 100;
      if (Math.abs(pctChange) > 10) {
        const direction = pctChange > 0 ? "increased" : "decreased";
        anomalies.push({
          anomaly_type: "gross_pay_change",
          severity: Math.abs(pctChange) > 20 ? "high" : "medium",
          confidence: "high",
          title: `Gross pay ${direction} by ${Math.abs(pctChange).toFixed(1)}%`,
          description: `Your gross pay changed from £${previous.gross_pay.toFixed(2)} to £${current.gross_pay.toFixed(2)}.`,
          suggested_action:
            "Check for pay rises, reduced hours, or changes in variable pay.",
        });
      }
    }

    // Same gross, different net
    if (
      current.gross_pay != null &&
      previous.gross_pay != null &&
      current.net_pay != null &&
      previous.net_pay != null
    ) {
      const grossSame = Math.abs(current.gross_pay - previous.gross_pay) < 1;
      const netDiff = Math.abs(current.net_pay - previous.net_pay);
      if (grossSame && netDiff > 20) {
        anomalies.push({
          anomaly_type: "same_gross_different_net",
          severity: "medium",
          confidence: "high",
          title: "Same gross pay but different net pay",
          description: `Your gross pay is essentially unchanged but your net pay shifted by £${netDiff.toFixed(2)}.`,
          suggested_action:
            "Something changed in your deductions — review tax, NI, and pension lines.",
        });
      }
    }

    // New deduction appeared
    const deductionFields: (keyof Extraction)[] = [
      "pension_amount",
      "student_loan_amount",
    ];
    for (const field of deductionFields) {
      const label = field.replace("_amount", "").replace("_", " ");
      if (
        (previous[field] == null || previous[field] === 0) &&
        current[field] != null &&
        (current[field] as number) > 0
      ) {
        anomalies.push({
          anomaly_type: "new_deduction",
          severity: "medium",
          confidence: "high",
          title: `New ${label} deduction appeared`,
          description: `A ${label} deduction of £${(current[field] as number).toFixed(2)} appeared this month but wasn't on the previous payslip.`,
          suggested_action: `Check if you've been enrolled into a ${label} scheme.`,
        });
      }
      // Deduction disappeared
      if (
        previous[field] != null &&
        (previous[field] as number) > 0 &&
        (current[field] == null || current[field] === 0)
      ) {
        anomalies.push({
          anomaly_type: "deduction_disappeared",
          severity: "medium",
          confidence: "high",
          title: `${label.charAt(0).toUpperCase() + label.slice(1)} deduction disappeared`,
          description: `A ${label} deduction of £${(previous[field] as number).toFixed(2)} was on the previous payslip but is missing now.`,
          suggested_action: "This could be intentional, but confirm with payroll.",
        });
      }
    }

    // --- UK-specific checks ---
    if (country === "UK" || country === "uk") {
      // NI change
      if (
        current.national_insurance_amount != null &&
        previous.national_insurance_amount != null &&
        current.gross_pay != null &&
        previous.gross_pay != null
      ) {
        const grossSame = Math.abs(current.gross_pay - previous.gross_pay) < 5;
        const niChange = Math.abs(
          current.national_insurance_amount -
            previous.national_insurance_amount
        );
        if (grossSame && niChange > 10) {
          anomalies.push({
            anomaly_type: "unusual_ni_change",
            severity: "medium",
            confidence: "medium",
            title: "Unusual National Insurance change",
            description: `Your NI changed by £${niChange.toFixed(2)} despite similar gross pay.`,
            suggested_action:
              "Check if your NI category has changed or if there's been a rate adjustment.",
          });
        }
      }

      // Tax change vs taxable pay
      if (
        current.tax_amount != null &&
        previous.tax_amount != null &&
        current.taxable_pay != null &&
        previous.taxable_pay != null
      ) {
        const taxableSame =
          Math.abs(current.taxable_pay - previous.taxable_pay) < 5;
        const taxChange = Math.abs(current.tax_amount - previous.tax_amount);
        if (taxableSame && taxChange > 20) {
          anomalies.push({
            anomaly_type: "unusual_tax_change",
            severity: "high",
            confidence: "medium",
            title: "Unusual tax change",
            description: `Your tax changed by £${taxChange.toFixed(2)} despite similar taxable pay. This may indicate a tax code change.`,
            suggested_action:
              "Check your tax code on the payslip and compare to previous months.",
          });
        }
      }
    }

    // --- Ireland-specific checks ---
    if (country === "Ireland" || country === "ireland") {
      // PRSI change
      if (
        current.prsi_amount != null &&
        previous.prsi_amount != null &&
        current.gross_pay != null &&
        previous.gross_pay != null
      ) {
        const grossSame = Math.abs(current.gross_pay - previous.gross_pay) < 5;
        const prsiChange = Math.abs(
          current.prsi_amount - previous.prsi_amount
        );
        if (grossSame && prsiChange > 10) {
          anomalies.push({
            anomaly_type: "unusual_prsi_change",
            severity: "medium",
            confidence: "medium",
            title: "Unusual PRSI change",
            description: `Your PRSI changed by €${prsiChange.toFixed(2)} despite similar gross pay.`,
            suggested_action:
              "Check if your PRSI class has changed.",
          });
        }
      }

      // USC change
      if (
        current.usc_amount != null &&
        previous.usc_amount != null &&
        current.gross_pay != null &&
        previous.gross_pay != null
      ) {
        const grossSame = Math.abs(current.gross_pay - previous.gross_pay) < 5;
        const uscChange = Math.abs(current.usc_amount - previous.usc_amount);
        if (grossSame && uscChange > 10) {
          anomalies.push({
            anomaly_type: "unusual_usc_change",
            severity: "medium",
            confidence: "medium",
            title: "Unusual USC change",
            description: `Your USC changed by €${uscChange.toFixed(2)} despite similar gross pay.`,
            suggested_action:
              "Check if your USC rate band or exemption has changed.",
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
    const { payslip_id } = await req.json();
    if (!payslip_id) {
      return new Response(
        JSON.stringify({ error: "payslip_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    const { data: prevPayslips } = await supabase
      .from("payslips")
      .select("id")
      .eq("user_id", payslip.user_id)
      .neq("id", payslip_id)
      .eq("status", "completed")
      .order("pay_date", { ascending: false })
      .limit(1);

    let previousExtraction: Extraction | null = null;
    if (prevPayslips && prevPayslips.length > 0) {
      const { data: prevExt } = await supabase
        .from("payslip_extractions")
        .select("*")
        .eq("payslip_id", prevPayslips[0].id)
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
      pension_amount: extracted.pension_amount as number | null,
      student_loan_amount: extracted.student_loan_amount as number | null,
      bonus_amount: extracted.bonus_amount as number | null,
      overtime_amount: extracted.overtime_amount as number | null,
      total_deductions: extracted.total_deductions as number | null,
    };

    const country =
      (extracted.country as string) || payslip.country || null;
    const anomalies = runAnomalyChecks(
      currentExtraction,
      previousExtraction,
      country
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
    console.error("process-payslip error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
