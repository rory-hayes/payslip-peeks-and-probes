import { Link } from 'react-router';
import type { CheckoutPriceId } from '@/lib/checkout-price';
import { getCustomerCheckoutPlan } from '@/lib/customer-pricing';

interface CheckoutPlanSummaryProps {
  checkoutPriceId: CheckoutPriceId | null;
  description: string;
}

/**
 * Keeps an intentional paid selection visible through authentication. The
 * selection is still revalidated by the server at checkout; this is only a
 * clear, editable customer-facing summary.
 */
export function CheckoutPlanSummary({ checkoutPriceId, description }: CheckoutPlanSummaryProps) {
  const plan = getCustomerCheckoutPlan(checkoutPriceId);
  if (!plan) return null;

  return (
    <aside
      aria-label="Selected paid plan"
      className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Selected paid plan</p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {plan.planName} · {plan.priceLabel}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {plan.billingDescription} {description}
      </p>
      <Link
        to={plan.pricingPath}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
      >
        Change plan
      </Link>
    </aside>
  );
}
