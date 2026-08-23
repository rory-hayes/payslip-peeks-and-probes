import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';

const state = vi.hoisted(() => ({ environment: 'sandbox' as 'sandbox' | 'live' | null }));

vi.mock('@/lib/stripe', () => ({
  getStripeEnvironment: () => state.environment,
}));

describe('PaymentTestModeBanner', () => {
  beforeEach(() => {
    state.environment = 'sandbox';
  });

  it('clearly says that test payments are not real charges', () => {
    render(<PaymentTestModeBanner />);

    expect(screen.getByText('Payments are currently in test mode. No real charge will be made.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('does not show on a live payment environment', () => {
    state.environment = 'live';
    render(<PaymentTestModeBanner />);

    expect(screen.queryByText(/test mode/i)).not.toBeInTheDocument();
  });
});
