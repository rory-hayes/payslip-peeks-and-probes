import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface RateLimitOptions {
  bucketKey: string;
  maxPerWindow: number;
  windowSeconds: number;
  client?: SupabaseClient;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

interface RateLimitRpcResult {
  allowed: boolean;
  current_count: number;
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

function windowStart(now: Date, windowSeconds: number): Date {
  const epoch = Math.floor(now.getTime() / 1000);
  const slot = epoch - (epoch % windowSeconds);
  return new Date(slot * 1000);
}

function isRateLimitResult(value: unknown): value is RateLimitRpcResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return typeof result.allowed === "boolean" && typeof result.current_count === "number";
}

/**
 * Consumes a bucket with a single database operation. Failure is deliberately
 * fail-closed: processing a private payslip is more sensitive than returning a
 * brief retry message during a database outage.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const supabase = opts.client ?? admin();
  const now = new Date();
  const start = windowStart(now, opts.windowSeconds);
  const retryAfterSeconds = Math.max(
    opts.windowSeconds - Math.floor((now.getTime() - start.getTime()) / 1000),
    1,
  );

  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket_key: opts.bucketKey,
    p_max_per_window: opts.maxPerWindow,
    p_window_start: start.toISOString(),
  });
  const result = Array.isArray(data) ? data[0] : data;

  if (error || !isRateLimitResult(result)) {
    console.error("[rate-limit] consume failed", { code: error?.code ?? "invalid_response" });
    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }

  return {
    allowed: result.allowed,
    retryAfterSeconds: result.allowed ? 0 : retryAfterSeconds,
    remaining: Math.max(opts.maxPerWindow - result.current_count, 0),
  };
}
