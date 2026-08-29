import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Pricing from './Pricing';

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  subscription: {
    plan: 'free' as const,
    status: 'active',
    isPremium: false,
    needsBillingReview: false,
  },
  subscriptionIsError: false,
  subscriptionIsFetching: false,
  subscriptionIsSuccess: true,
  refetchSubscription: vi.fn(),
  profileCurrency: 'EUR' as 'EUR' | 'GBP',
  profileIsError: false,
  profileIsFetching: false,
  profileIsSuccess: true,
  refetchProfile: vi.fn(),
}));

const payments = vi.hoisted(() => ({ configured: true }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: state.user }),
}));

vi.mock('@/hooks/use-subscription', () => ({
  useSubscription: () => ({
    subscription: state.subscription,
    isError: state.subscriptionIsError,
    isFetching: state.subscriptionIsFetching,
    isSuccess: state.subscriptionIsSuccess,
    refetch: state.refetchSubscription,
  }),
}));

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({
    data: state.profileIsSuccess ? { currency: state.profileCurrency } : undefined,
    isError: state.profileIsError,
    isFetching: state.profileIsFetching,
    isSuccess: state.profileIsSuccess,
    refetch: state.refetchProfile,
  }),
}));

vi.mock('@/components/PaymentTestModeBanner', () => ({
  PaymentTestModeBanner: () => null,
}));

vi.mock('@/lib/stripe', () => ({
  isPaymentsClientConfigured: () => payments.configured,
}));

const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

function renderPricing(initialEntry = '/pricing') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Pricing />
      <Location />
    </MemoryRouter>,
  );
}

describe('Pricing', () => {
  beforeEach(() => {
    state.user = null;
    state.subscription = {
      plan: 'free',
      status: 'active',
      isPremium: false,
      needsBillingReview: false,
    };
    state.subscriptionIsError = false;
    state.subscriptionIsFetching = false;
    state.subscriptionIsSuccess = true;
    state.refetchSubscription.mockReset();
    state.profileCurrency = 'EUR';
    state.profileIsError = false;
    state.profileIsFetching = false;
    state.profileIsSuccess = true;
    state.refetchProfile.mockReset();
    payments.configured = true;
  });

  it('describes PDF export as a Free feature instead of a paid-only feature', () => {
    renderPricing();

    const pdfExport = screen.getByText('PDF export of your payslip history');
    expect(pdfExport).toBeInTheDocument();
    expect(screen.getAllByText('PDF export of your payslip history')).toHaveLength(1);
    expect(pdfExport.closest('div[class*="p-8"]')).toHaveTextContent('Free');
  });

  it('includes the official-source tax-year review on every plan', () => {
    renderPricing();

    const feature = screen.getByText('UK or Ireland tax-year action plan and records checklist');
    expect(feature.closest('div[class*="p-8"]')).toHaveTextContent('Free');
    expect(screen.getByRole('row', { name: /Tax-year action plan & records checklist Included Included Included/i })).toBeInTheDocument();
  });

  it('uses a bounded Free trial that proves the first comparison without renewing automatic checks', () => {
    renderPricing();

    expect(screen.getByText('2 automatic payslip checks total')).toBeInTheDocument();
    expect(screen.getByText('Enough to unlock your first real comparison')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Automatic payslip checks 2 total 6 \/ calendar month 6 \/ calendar month/i })).toBeInTheDocument();
    expect(screen.queryByText('3 automatic payslip checks per calendar month')).not.toBeInTheDocument();
  });

  it('keeps the pricing decision inside a labelled main landmark', () => {
    renderPricing();

    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Simple, transparent pricing' }));
  });

  it('uses the matching allowed Plus checkout plan for yearly and monthly billing', () => {
    state.user = { id: 'user-1' };
    const yearly = renderPricing();

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Plus' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout?price=plus_yearly');

    // Return to the pricing route in a fresh render to verify the alternate billing option.
    yearly.unmount();
    renderPricing();
    fireEvent.click(screen.getByRole('switch', { name: 'Use monthly Plus billing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Plus' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/checkout?price=plus_monthly');
  });

  it('keeps a guest’s selected paid plan while they create an account', () => {
    renderPricing();

    fireEvent.click(screen.getByRole('button', { name: 'Choose Plus' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/sign-up?checkout=plus_yearly');
  });

  it('shows a signed-in UK customer only GBP prices and sends the matching plan to checkout', () => {
    state.user = { id: 'user-1' };
    state.profileCurrency = 'GBP';
    renderPricing('/pricing');

    expect(screen.queryByRole('group', { name: 'Choose billing currency' })).not.toBeInTheDocument();
    expect(screen.getByText('New purchases are shown in GBP (£) for your United Kingdom account.')).toBeInTheDocument();
    expect(screen.getByText('£17.99')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Plus' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/checkout?price=plus_yearly_gbp');
  });

  it('makes the currency choice understandable to assistive technology', () => {
    renderPricing();

    const pounds = screen.getByRole('button', { name: 'Show prices in pounds sterling' });
    expect(pounds).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pounds);

    expect(pounds).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('£17.99')).toBeInTheDocument();
    expect(screen.getByText('Prices are shown for United Kingdom in GBP.')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/pricing?currency=GBP');

    fireEvent.click(screen.getByRole('button', { name: 'Show prices in euro' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/pricing');
  });

  it('honours a supported pricing-currency link from the marketing page', () => {
    renderPricing('/pricing?currency=GBP');

    expect(screen.getByRole('button', { name: 'Show prices in pounds sterling' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('£17.99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Plus' })).toBeInTheDocument();
  });

  it('states the recurring charge beside the Plus purchase action', () => {
    renderPricing();

    expect(screen.getByText('Billed €19.99 today, then every year until you cancel.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing terms' })).toHaveAttribute('href', '/terms');

    fireEvent.click(screen.getByRole('switch', { name: 'Use monthly Plus billing' }));

    expect(screen.getByText('Billed €3.49 today, then every month until you cancel.')).toBeInTheDocument();
  });

  it('keeps a selected billing interval in the URL and restores it from a shared link', () => {
    renderPricing('/pricing?currency=GBP&billing=monthly');

    expect(screen.getByText('£2.99')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Use yearly Plus billing' })).toBeChecked();

    fireEvent.click(screen.getByRole('switch', { name: 'Use yearly Plus billing' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/pricing?currency=GBP');
    expect(screen.getByText('£17.99')).toBeInTheDocument();
  });

  it('makes clear that a billing-currency choice does not change payslip review country', () => {
    renderPricing();

    expect(screen.getByText('Choose the currency for your plan. It does not change the country you select when reviewing a payslip.')).toBeInTheDocument();
  });

  it('keeps the full plan comparison available to assistive technology', () => {
    renderPricing();

    expect(screen.getByRole('region', { name: /plan feature comparison/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /compare the free, plus, and lifetime plans/i })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Automatic payslip checks' })).toBeInTheDocument();
  });

  it('does not offer a broken paid route when browser payment configuration is absent', () => {
    state.user = { id: 'user-1' };
    payments.configured = false;
    renderPricing();

    const paidButtons = screen.getAllByRole('button', { name: 'Checkout unavailable' });
    expect(paidButtons).toHaveLength(2);
    paidButtons.forEach((button) => expect(button).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Plan unavailable' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Current plan' })).not.toBeInTheDocument();
    expect(screen.getByText('Online checkout is unavailable right now, so we cannot confirm your billing status in this browser.')).toBeInTheDocument();

    fireEvent.click(paidButtons[0]);
    expect(screen.getByTestId('location')).toHaveTextContent('/pricing');
  });

  it('waits to show account plan actions until an authenticated subscription is settled', () => {
    state.user = { id: 'user-1' };
    state.subscriptionIsSuccess = false;
    renderPricing();

    const checkingButtons = screen.getAllByRole('button', { name: 'Checking your plan…' });
    expect(checkingButtons).toHaveLength(3);
    checkingButtons.forEach((button) => expect(button).toBeDisabled());
    expect(screen.queryByRole('button', { name: 'Upgrade to Plus' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Current plan' })).not.toBeInTheDocument();
    expect(screen.getByText('Checking your plan before we show account actions…')).toBeInTheDocument();
  });

  it('blocks paid actions when subscription lookup fails and lets the customer retry', () => {
    state.user = { id: 'user-1' };
    state.subscriptionIsSuccess = false;
    state.subscriptionIsError = true;
    state.refetchSubscription.mockResolvedValue(undefined);
    renderPricing();

    const unavailableButtons = screen.getAllByRole('button', { name: 'Plan status unavailable' });
    expect(unavailableButtons).toHaveLength(3);
    unavailableButtons.forEach((button) => expect(button).toBeDisabled());
    expect(screen.queryByRole('button', { name: 'Upgrade to Plus' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t confirm your plan. We have not changed your plan or started a checkout.');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(state.refetchSubscription).toHaveBeenCalledTimes(1);
  });
});
