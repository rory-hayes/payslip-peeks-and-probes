// Lightweight token-bucket rate limiter backed by a single SQL upsert per check.
// Buckets are keyed (e.g. `process-payslip:user:abc`, `process-payslip:ip:1.2.3.4`).
// Window resets every `windowSeconds`; counts above `maxPerWindow` are denied.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

let cached: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  return cached;
}

/** Round timestamp to start of the current window (UTC). */
function windowStart(now: Date, windowSeconds: number): Date {
  const epoch = Math.floor(now.getTime() / 1000);
  const slot = epoch - (epoch % windowSeconds);
  return new Date(slot * 1000);
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const supabase = opts.client ?? admin();
  const now = new Date();
  const ws = windowStart(now, opts.windowSeconds);

  // Fetch existing bucket row for this window.
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("bucket_key", opts.bucketKey)
    .eq("window_start", ws.toISOString())
    .maybeSingle();

  const currentCount = existing?.count ?? 0;
  if (currentCount >= opts.maxPerWindow) {
    const retry = opts.windowSeconds - Math.floor((now.getTime() - ws.getTime()) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retry, 1), remaining: 0 };
  }

  // Atomically increment (or insert) the counter for this window.
  const { error } = await supabase
    .from("rate_limits")
    .upsert(
      {
        bucket_key: opts.bucketKey,
        window_start: ws.toISOString(),
        count: currentCount + 1,
      },
      { onConflict: "bucket_key,window_start" }
    );

  // Best-effort cleanup of expired buckets (older than 1 day).
  if (Math.random() < 0.05) {
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("rate_limits").delete().lt("window_start", cutoff);
  }

  if (error) {
    // On infrastructure error, fail open (better UX than locking everyone out).
    console.error("rate_limit upsert failed", error);
    return { allowed: true, retryAfterSeconds: 0, remaining: opts.maxPerWindow - currentCount - 1 };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: opts.maxPerWindow - currentCount - 1,
  };
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
