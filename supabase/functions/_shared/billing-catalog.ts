export type CheckoutMode = "payment" | "subscription";

export interface PriceCatalogEntry {
  plan: "plus" | "lifetime";
  mode: CheckoutMode;
}

/** Server-owned product catalog; clients can never expand it. */
export const PRICE_CATALOG = {
  plus_yearly: { plan: "plus", mode: "subscription" },
  plus_monthly: { plan: "plus", mode: "subscription" },
  plus_yearly_gbp: { plan: "plus", mode: "subscription" },
  plus_monthly_gbp: { plan: "plus", mode: "subscription" },
  lifetime_once: { plan: "lifetime", mode: "payment" },
  lifetime_once_gbp: { plan: "lifetime", mode: "payment" },
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
