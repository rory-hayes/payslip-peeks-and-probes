import type { CheckoutPriceId } from './checkout-price';

export const PRICE_CURRENCIES = ['EUR', 'GBP'] as const;

export type PriceCurrency = typeof PRICE_CURRENCIES[number];

export const PRICE_BILLING_INTERVALS = ['yearly', 'monthly'] as const;

export type PriceBillingInterval = typeof PRICE_BILLING_INTERVALS[number];

interface RecurringCustomerPrice {
  checkoutPriceId: CheckoutPriceId;
  display: string;
  interval: 'month' | 'year';
  minorUnits: number;
}

interface OneOffCustomerPrice {
  checkoutPriceId: CheckoutPriceId;
  display: string;
  minorUnits: number;
}

export interface CustomerPricing {
  countryLabel: string;
  currency: PriceCurrency;
  plus: {
    monthly: RecurringCustomerPrice;
    yearly: RecurringCustomerPrice;
  };
  symbol: string;
  yearlyPerMonth: string;
  lifetime: OneOffCustomerPrice;
}

export interface CustomerCheckoutPlan {
  billingDescription: string;
  checkoutPriceId: CheckoutPriceId;
  currency: PriceCurrency;
  planName: 'Plus' | 'Lifetime';
  priceLabel: string;
  pricingPath: string;
}

/**
 * Client-facing labels for the same fixed lookup keys validated by the
 * server-owned billing catalog. Keep commercial presentation here rather
 * than allowing marketing and checkout screens to silently disagree.
 */
export const CUSTOMER_PRICING: Record<PriceCurrency, CustomerPricing> = {
  EUR: {
    countryLabel: 'Ireland',
    currency: 'EUR',
    symbol: '€',
    yearlyPerMonth: '1.67',
    plus: {
      yearly: { checkoutPriceId: 'plus_yearly', display: '19.99', interval: 'year', minorUnits: 1999 },
      monthly: { checkoutPriceId: 'plus_monthly', display: '3.49', interval: 'month', minorUnits: 349 },
    },
    lifetime: { checkoutPriceId: 'lifetime_once', display: '34.99', minorUnits: 3499 },
  },
  GBP: {
    countryLabel: 'United Kingdom',
    currency: 'GBP',
    symbol: '£',
    yearlyPerMonth: '1.50',
    plus: {
      yearly: { checkoutPriceId: 'plus_yearly_gbp', display: '17.99', interval: 'year', minorUnits: 1799 },
      monthly: { checkoutPriceId: 'plus_monthly_gbp', display: '2.99', interval: 'month', minorUnits: 299 },
    },
    lifetime: { checkoutPriceId: 'lifetime_once_gbp', display: '29.99', minorUnits: 2999 },
  },
};

export function getPriceCurrency(value: unknown): PriceCurrency | null {
  return typeof value === 'string' && (PRICE_CURRENCIES as readonly string[]).includes(value)
    ? value as PriceCurrency
    : null;
}

export function getPriceBillingInterval(value: unknown): PriceBillingInterval | null {
  return typeof value === 'string' && (PRICE_BILLING_INTERVALS as readonly string[]).includes(value)
    ? value as PriceBillingInterval
    : null;
}

export function pricingPathForCurrency(currency: PriceCurrency): string {
  return currency === 'GBP' ? '/pricing?currency=GBP' : '/pricing';
}

/**
 * Keeps a shared pricing link for a deliberate recurring selection. A plan is
 * still only chargeable after the server accepts its allowlisted lookup key.
 */
export function pricingPathForSelection(
  currency: PriceCurrency,
  billing: PriceBillingInterval = 'yearly',
): string {
  const searchParams = new URLSearchParams();
  if (currency === 'GBP') searchParams.set('currency', currency);
  if (billing === 'monthly') searchParams.set('billing', billing);

  const query = searchParams.toString();
  return query ? `/pricing?${query}` : '/pricing';
}

/**
 * A customer-visible summary for an allowlisted checkout key. This gives a
 * person a way to verify their intended plan while creating or signing into an
 * account, without treating the URL value as an entitlement.
 */
export function getCustomerCheckoutPlan(priceId: CheckoutPriceId | null): CustomerCheckoutPlan | null {
  if (!priceId) return null;

  for (const currency of PRICE_CURRENCIES) {
    const pricing = CUSTOMER_PRICING[currency];
    const { symbol } = pricing;

    if (pricing.plus.yearly.checkoutPriceId === priceId) {
      return {
        billingDescription: 'Billed yearly until you cancel.',
        checkoutPriceId: priceId,
        currency,
        planName: 'Plus',
        priceLabel: `${symbol}${pricing.plus.yearly.display} / year`,
        pricingPath: pricingPathForSelection(currency, 'yearly'),
      };
    }

    if (pricing.plus.monthly.checkoutPriceId === priceId) {
      return {
        billingDescription: 'Billed monthly until you cancel.',
        checkoutPriceId: priceId,
        currency,
        planName: 'Plus',
        priceLabel: `${symbol}${pricing.plus.monthly.display} / month`,
        pricingPath: pricingPathForSelection(currency, 'monthly'),
      };
    }

    if (pricing.lifetime.checkoutPriceId === priceId) {
      return {
        billingDescription: 'One payment. It does not renew.',
        checkoutPriceId: priceId,
        currency,
        planName: 'Lifetime',
        priceLabel: `${symbol}${pricing.lifetime.display} once`,
        pricingPath: pricingPathForCurrency(currency),
      };
    }
  }

  return null;
}
