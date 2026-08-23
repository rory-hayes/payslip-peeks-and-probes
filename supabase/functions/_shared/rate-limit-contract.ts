/**
 * Dependency-free validation for the durable rate-limit RPC. Keeping this
 * separate from the Supabase client lets the same fail-closed contract be
 * exercised in the web test suite.
 */

export interface RateLimitWindow {
  start: Date;
  retryAfterSeconds: number;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Values passed to the SQL counter must be positive whole numbers. */
export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

/**
 * Calculates the fixed-window bucket and the conservative retry duration.
 * Invalid dates or duration configuration intentionally return null so callers
 * can deny the request before issuing a database mutation.
 */
export function createRateLimitWindow(now: Date, windowSeconds: number): RateLimitWindow | null {
  const nowMilliseconds = now.getTime();
  if (!Number.isFinite(nowMilliseconds) || !isPositiveSafeInteger(windowSeconds)) {
    return null;
  }

  const epochSeconds = Math.floor(nowMilliseconds / 1000);
  const startSeconds = epochSeconds - (epochSeconds % windowSeconds);
  const start = new Date(startSeconds * 1000);
  const elapsedSeconds = Math.floor((nowMilliseconds - start.getTime()) / 1000);

  if (
    !Number.isFinite(start.getTime())
    || !Number.isSafeInteger(elapsedSeconds)
    || elapsedSeconds < 0
    || elapsedSeconds >= windowSeconds
  ) {
    return null;
  }

  return {
    start,
    retryAfterSeconds: Math.max(windowSeconds - elapsedSeconds, 1),
  };
}

function readSingleRpcRow(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.length === 1 ? value[0] : null;
}

function readRateLimitRpcResult(value: unknown): RateLimitRpcResult | null {
  const result = readSingleRpcRow(value);
  if (!isRecord(result)) return null;

  if (
    typeof result.allowed !== "boolean"
    || !isPositiveSafeInteger(result.current_count)
  ) {
    return null;
  }

  return {
    allowed: result.allowed,
    current_count: result.current_count,
  };
}

/**
 * Accepts only the exact one-row shape returned by consume_rate_limit. The
 * boolean must agree with the counter: accepting contradictory data could
 * bypass a quota if a provider returned a stale or malformed response.
 */
export function resolveRateLimitResult(
  value: unknown,
  maxPerWindow: number,
  retryAfterSeconds: number,
): RateLimitResult | null {
  if (!isPositiveSafeInteger(maxPerWindow) || !isPositiveSafeInteger(retryAfterSeconds)) {
    return null;
  }

  const result = readRateLimitRpcResult(value);
  if (!result || result.allowed !== (result.current_count <= maxPerWindow)) {
    return null;
  }

  return {
    allowed: result.allowed,
    retryAfterSeconds: result.allowed ? 0 : retryAfterSeconds,
    remaining: Math.max(maxPerWindow - result.current_count, 0),
  };
}

/** Always return a usable retry value when the counter cannot be trusted. */
export function deniedRateLimitResult(retryAfterSeconds?: number): RateLimitResult {
  return {
    allowed: false,
    retryAfterSeconds: isPositiveSafeInteger(retryAfterSeconds) ? retryAfterSeconds : 1,
    remaining: 0,
  };
}
