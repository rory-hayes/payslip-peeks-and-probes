export type CheckoutMode = "payment" | "subscription";

interface RecurringPriceContract {
  interval: "month" | "year";
  intervalCount: number;
}

export interface PriceCatalogEntry {
  plan: "plus" | "lifetime";
  mode: CheckoutMode;
  currency: "eur" | "gbp";
  unitAmount: number;
  recurring?: RecurringPriceContract;
}

/**
 * Server-owned product catalog. Stripe lookup keys select a product, but the
 * amount, currency and interval are also contractual: a dashboard label must
 * never say one price while Checkout charges another.
 */
export const PRICE_CATALOG = {
  plus_yearly: { plan: "plus", mode: "subscription", currency: "eur", unitAmount: 1999, recurring: { interval: "year", intervalCount: 1 } },
  plus_monthly: { plan: "plus", mode: "subscription", currency: "eur", unitAmount: 349, recurring: { interval: "month", intervalCount: 1 } },
  plus_yearly_gbp: { plan: "plus", mode: "subscription", currency: "gbp", unitAmount: 1799, recurring: { interval: "year", intervalCount: 1 } },
  plus_monthly_gbp: { plan: "plus", mode: "subscription", currency: "gbp", unitAmount: 299, recurring: { interval: "month", intervalCount: 1 } },
  lifetime_once: { plan: "lifetime", mode: "payment", currency: "eur", unitAmount: 3499 },
  lifetime_once_gbp: { plan: "lifetime", mode: "payment", currency: "gbp", unitAmount: 2999 },
} as const satisfies Record<string, PriceCatalogEntry>;

export type PriceLookupKey = keyof typeof PRICE_CATALOG;

export function getPriceCatalogEntry(value: unknown): PriceCatalogEntry | null {
  if (typeof value !== "string") return null;
  if (!Object.prototype.hasOwnProperty.call(PRICE_CATALOG, value)) return null;
  return PRICE_CATALOG[value as PriceLookupKey];
}

export function isAllowedPriceLookupKey(value: unknown): value is PriceLookupKey {
  return getPriceCatalogEntry(value) !== null;
}

/** Minimal Stripe Price shape, kept runtime-safe for edge-function responses. */
interface StripePriceCandidate {
  active?: unknown;
  currency?: unknown;
  lookup_key?: unknown;
  recurring?: unknown;
  type?: unknown;
  unit_amount?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Verify the full commercial contract rather than trusting a mutable Stripe
 * lookup key alone. This intentionally rejects tiered/custom-amount prices.
 */
export function matchesCatalogStripePrice(value: unknown, lookupKey: unknown): boolean {
  const catalogEntry = getPriceCatalogEntry(lookupKey);
  if (!catalogEntry || !isRecord(value)) return false;

  const price = value as StripePriceCandidate;
  if (
    price.active !== true
    || price.lookup_key !== lookupKey
    || price.type !== catalogEntry.mode
    || typeof price.currency !== "string"
    || price.currency.toLowerCase() !== catalogEntry.currency
    || price.unit_amount !== catalogEntry.unitAmount
  ) {
    return false;
  }

  if (!catalogEntry.recurring) return price.recurring === null;
  if (!isRecord(price.recurring)) return false;

  return price.recurring.interval === catalogEntry.recurring.interval
    && price.recurring.interval_count === catalogEntry.recurring.intervalCount;
}
