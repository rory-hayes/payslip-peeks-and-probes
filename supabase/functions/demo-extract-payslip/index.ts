import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// The previous anonymous demo accepted raw payslips and sent them to an
// extraction provider. It is intentionally retired until there is a separate,
// consented demo privacy design and a provider contract that can support it.
serve(() => new Response(JSON.stringify({
  code: "demo_retired",
  error: "The anonymous payslip demo is not available.",
}), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
