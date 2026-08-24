import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  getPriceCatalogEntry,
  isAllowedPriceLookupKey,
  matchesCatalogStripePrice,
  PRICE_CATALOG,
  type PriceCatalogEntry,
  type PriceLookupKey,
} from "./billing-catalog.ts";

export type StripeEnv = "sandbox" | "live";

export {
  getPriceCatalogEntry,
  isAllowedPriceLookupKey,
  matchesCatalogStripePrice,
  PRICE_CATALOG,
  type PriceCatalogEntry,
  type PriceLookupKey,
};

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

function requiredSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getStripeEnvironment(): StripeEnv {
  const value = requiredSecret("PAYCHECK_STRIPE_ENV");
  if (value !== "sandbox" && value !== "live") {
    throw new Error("PAYCHECK_STRIPE_ENV must be either sandbox or live");
  }
  return value;
}

function getStripeSecretKey(environment: StripeEnv): string {
  return requiredSecret(
    environment === "sandbox" ? "STRIPE_SANDBOX_SECRET_KEY" : "STRIPE_LIVE_SECRET_KEY",
  );
}

/**
 * Edge Functions talk to Stripe directly. Third-party connector credentials
 * and browser-side payment secrets are deliberately not part of this boundary.
 */
export function createStripeClient(environment: StripeEnv = getStripeEnvironment()): Stripe {
  return new Stripe(getStripeSecretKey(environment), {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getAppOrigin(): URL {
  const appOrigin = requiredSecret("PAYCHECK_APP_ORIGIN");
  const origin = new URL(appOrigin);
  if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
    throw new Error("PAYCHECK_APP_ORIGIN must use HTTPS outside local development");
  }
  return origin;
}

export function getCheckoutReturnUrl(): string {
  const origin = getAppOrigin();
  return new URL(
    "/checkout/return?session_id={CHECKOUT_SESSION_ID}",
    origin.origin,
  ).toString();
}

export function checkoutIntentIdempotencyKey(intentId: string): string {
  return `paycheck-checkout-intent:${intentId}`;
}

export function getCheckoutIntentId(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.checkoutIntentId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isWebhookEvent(value: unknown): value is StripeWebhookEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  if (
    typeof event.id !== "string"
    || event.id.length === 0
    || typeof event.type !== "string"
    || !event.data
    || typeof event.data !== "object"
  ) return false;
  const data = event.data as Record<string, unknown>;
  return Boolean(data.object && typeof data.object === "object");
}

export async function verifyWebhook(req: Request, environment: StripeEnv): Promise<StripeWebhookEvent> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = requiredSecret(
    environment === "sandbox"
      ? "PAYMENTS_SANDBOX_WEBHOOK_SECRET"
      : "PAYMENTS_LIVE_WEBHOOK_SECRET",
  );

  if (!signature || !body) throw new Error("Missing webhook signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1" && value) v1Signatures.push(value);
  }

  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid webhook signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  const event: unknown = JSON.parse(body);
  if (!isWebhookEvent(event)) throw new Error("Invalid webhook payload");
  return event;
}
