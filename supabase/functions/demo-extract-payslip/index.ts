// Anonymous payslip extraction for the landing-page demo.
// - No DB writes (extraction is returned in the response only)
// - IP-rate-limited (1/day per IP) using the shared rate-limit table
// - Hard 5MB upload cap
// Mirrors the prompt + response shape of process-payslip but with no save step.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIp } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

const EXTRACTION_PROMPT = `You are a payslip data extraction assistant. Analyze this payslip document and extract the most important figures for a brief preview.

Return a JSON object using this exact schema (use null for fields you cannot find):

{
  "country": "UK or Ireland or Germany or France or Netherlands or Spain or Italy or Belgium or Portugal or null",
  "employer_name": "string or null",
  "pay_date": "YYYY-MM-DD or null",
  "gross_pay": number or null,
  "net_pay": number or null,
  "tax_amount": number or null,
  "social_security_amount": number or null,
  "pension_amount": number or null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- All monetary values should be plain numbers (no currency symbols, no thousand separators)
- Use the EMPLOYEE share of contributions
- For European payslips the decimal separator on the document is often a comma — convert to a dot
- Only return the JSON object, no other text`;

interface DemoExtraction {
  country: string | null;
  employer_name: string | null;
  pay_date: string | null;
  gross_pay: number | null;
  net_pay: number | null;
  tax_amount: number | null;
  social_security_amount: number | null;
  pension_amount: number | null;
  confidence: "high" | "medium" | "low";
}

interface DemoAnomaly {
  severity: "info" | "low" | "medium" | "high";
  title: string;
  description: string;
}

/**
 * Lightweight, single-shot anomaly logic for the demo. We don't have prior
 * payslips to compare against, so we only flag self-evident issues.
 * Always returns at least one item so the demo demonstrates value.
 */
function buildDemoAnomaly(e: DemoExtraction): DemoAnomaly {
  if (e.gross_pay == null || e.net_pay == null) {
    return {
      severity: "high",
      title: "Couldn't read the key figures",
      description:
        "We couldn't extract gross or net pay from this document. The full PayCheck app handles low-quality scans better and lets you correct values manually.",
    };
  }
  if (e.net_pay > e.gross_pay) {
    return {
      severity: "high",
      title: "Net pay exceeds gross pay",
      description: `Your net (${e.net_pay.toFixed(2)}) is higher than your gross (${e.gross_pay.toFixed(2)}). This usually means a refund or back-pay adjustment — worth confirming with payroll.`,
    };
  }
  const deductions = e.gross_pay - e.net_pay;
  const ratio = deductions / e.gross_pay;
  if (ratio < 0.05 && (e.tax_amount ?? 0) === 0) {
    return {
      severity: "medium",
      title: "Almost no tax was deducted",
      description: `Only ${(ratio * 100).toFixed(1)}% of your gross pay was deducted, and we couldn't find an income-tax line. If you expect to pay tax, check your tax code or status with payroll.`,
    };
  }
  if (ratio > 0.55) {
    return {
      severity: "medium",
      title: "Deductions look unusually high",
      description: `${(ratio * 100).toFixed(1)}% of your gross pay was deducted. That's higher than typical — worth double-checking pension, student loan, and tax-code lines.`,
    };
  }
  return {
    severity: "info",
    title: "Looks healthy at a glance",
    description: `${(ratio * 100).toFixed(1)}% of your gross was deducted. Sign up to track this every month and get alerts when it changes unexpectedly.`,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Rate limit by IP — 1 demo extraction per IP per day.
    const ipKey = getClientIp(req);
    const rl = await checkRateLimit({
      bucketKey: `demo-extract:ip:${ipKey}`,
      maxPerWindow: 1,
      windowSeconds: 24 * 60 * 60,
    });
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({
          error: "demo_limit_reached",
          message: "You've used your free demo extraction for today. Sign up free for unlimited uploads.",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfterSeconds),
          },
        }
      );
    }

    // Parse multipart upload
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "Send the file as multipart/form-data with field 'file'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "Missing 'file' upload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (file.size > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: "File too large. Demo upload is limited to 5MB." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.includes(mime)) {
      return new Response(
        JSON.stringify({ error: "Unsupported file type. Upload a PDF or image (PNG/JPEG/WEBP)." }),
        { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const base64 = btoa(binary);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
              { type: "text", text: "Extract the key figures from this payslip." },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[demo-extract-payslip] AI gateway error:", aiResponse.status, errText);
      const status = aiResponse.status === 429 || aiResponse.status === 402 ? aiResponse.status : 502;
      return new Response(
        JSON.stringify({ error: "extraction_failed", message: "We couldn't read this payslip — please try a clearer scan." }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "";
    let extracted: DemoExtraction;
    try {
      const jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("[demo-extract-payslip] parse error:", raw);
      return new Response(
        JSON.stringify({ error: "parse_failed", message: "We couldn't read this payslip — please try a clearer scan." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anomaly = buildDemoAnomaly(extracted);

    return new Response(
      JSON.stringify({
        success: true,
        extraction: extracted,
        anomaly,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[demo-extract-payslip] error:", e);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "Something went wrong. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
