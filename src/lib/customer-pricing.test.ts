import { describe, expect, it } from 'vitest';
import { PRICE_CATALOG } from '../../supabase/functions/_shared/billing-catalog';
import {
  CUSTOMER_PRICING,
  checkoutPriceForCurrency,
  getCustomerCheckoutPlan,
  getPriceBillingInterval,
  getPriceCurrency,
  pricingPathForCurrency,
  pricingPathForSelection,
} from './customer-pricing';

describe('customer pricing catalog', () => {
  it('uses the same fixed commercial terms as the server-owned billing catalog', () => {
    Object.values(CUSTOMER_PRICING).forEach((pricing) => {
      const prices = [pricing.plus.yearly, pricing.plus.monthly, pricing.lifetime];

      prices.forEach((price) => {
        const serverPrice = PRICE_CATALOG[price.checkoutPriceId];

        expect(serverPrice.currency).toBe(pricing.currency.toLowerCase());
        expect(serverPrice.unitAmount).toBe(price.minorUnits);
      });

      expect(PRICE_CATALOG[pricing.plus.yearly.checkoutPriceId]).toMatchObject({
        mode: 'subscription',
        recurring: { interval: 'year', intervalCount: 1 },
      });
      expect(PRICE_CATALOG[pricing.plus.monthly.checkoutPriceId]).toMatchObject({
        mode: 'subscription',
        recurring: { interval: 'month', intervalCount: 1 },
      });
      expect(PRICE_CATALOG[pricing.lifetime.checkoutPriceId]).toMatchObject({ mode: 'payment' });
    });
  });

  it('only accepts supported currencies and keeps the default pricing URL clean', () => {
    expect(getPriceCurrency('EUR')).toBe('EUR');
    expect(getPriceCurrency('GBP')).toBe('GBP');
    expect(getPriceCurrency('usd')).toBeNull();
    expect(pricingPathForCurrency('EUR')).toBe('/pricing');
    expect(pricingPathForCurrency('GBP')).toBe('/pricing?currency=GBP');
  });

  it('keeps a selected paid plan visible with its exact billed currency and interval', () => {
    expect(getCustomerCheckoutPlan('plus_monthly_gbp')).toMatchObject({
      planName: 'Plus',
      priceLabel: '£2.99 / month',
      billingDescription: 'Billed monthly until you cancel.',
      pricingPath: '/pricing?currency=GBP&billing=monthly',
    });
    expect(getCustomerCheckoutPlan('lifetime_once')).toMatchObject({
      planName: 'Lifetime',
      priceLabel: '€34.99 once',
      billingDescription: 'One payment. It does not renew.',
      pricingPath: '/pricing',
    });
    expect(getCustomerCheckoutPlan(null)).toBeNull();
  });

  it('keeps an explicitly selected recurring interval in a shareable pricing URL', () => {
    expect(getPriceBillingInterval('monthly')).toBe('monthly');
    expect(getPriceBillingInterval('quarterly')).toBeNull();
    expect(pricingPathForSelection('EUR', 'monthly')).toBe('/pricing?billing=monthly');
    expect(pricingPathForSelection('GBP', 'monthly')).toBe('/pricing?currency=GBP&billing=monthly');
  });

  it('keeps the plan and interval while matching checkout to the customer country currency', () => {
    expect(checkoutPriceForCurrency('plus_yearly', 'GBP')).toBe('plus_yearly_gbp');
    expect(checkoutPriceForCurrency('plus_monthly_gbp', 'EUR')).toBe('plus_monthly');
    expect(checkoutPriceForCurrency('lifetime_once', 'GBP')).toBe('lifetime_once_gbp');
  });
});
