import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createRateLimitWindow,
  deniedRateLimitResult,
  isPositiveSafeInteger,
  resolveRateLimitResult,
  type RateLimitResult,
} from "./rate-limit-contract.ts";

export interface RateLimitOptions {
  bucketKey: string;
  maxPerWindow: number;
  windowSeconds: number;
  client?: SupabaseClient;
}

let cached: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  return cached;
}

export type { RateLimitResult } from "./rate-limit-contract.ts";

/**
 * Consumes a bucket with a single database operation. Failure is deliberately
 * fail-closed: processing a private payslip is more sensitive than returning a
 * brief retry message during a database outage.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const window = createRateLimitWindow(new Date(), opts.windowSeconds);

  if (!window || !isPositiveSafeInteger(opts.maxPerWindow)) {
    console.error("[rate-limit] invalid configuration");
    return deniedRateLimitResult(window?.retryAfterSeconds);
  }

  const supabase = opts.client ?? admin();

  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket_key: opts.bucketKey,
    p_max_per_window: opts.maxPerWindow,
    p_window_start: window.start.toISOString(),
  });
  const result = error
    ? null
    : resolveRateLimitResult(data, opts.maxPerWindow, window.retryAfterSeconds);

  if (!result) {
    console.error("[rate-limit] consume failed", { code: error?.code ?? "invalid_response" });
    return deniedRateLimitResult(window.retryAfterSeconds);
  }

  return result;
}
