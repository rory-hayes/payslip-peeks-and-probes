import { useEffect, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

const { invoke, getStripe, payments } = vi.hoisted(() => ({
  invoke: vi.fn(),
  getStripe: vi.fn(),
  payments: { configured: true, environment: 'sandbox' as 'sandbox' | 'live' | null },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe,
  getStripeEnvironment: () => payments.environment,
  isPaymentsClientConfigured: () => payments.configured,
}));

vi.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({
    children,
    options,
  }: {
    children: ReactNode;
    options: { fetchClientSecret: () => Promise<string> };
  }) => {
    useEffect(() => {
      void options.fetchClientSecret().catch(() => undefined);
    }, [options]);
    return <div>{children}</div>;
  },
  EmbeddedCheckout: () => <div>Stripe checkout</div>,
}));

describe("StripeEmbeddedCheckout", () => {
  beforeEach(() => {
    invoke.mockReset();
    getStripe.mockReset();
    getStripe.mockResolvedValue({});
    payments.configured = true;
    payments.environment = 'sandbox';
  });

  it("shows an existing-plan state instead of a generic checkout failure", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Function returned a non-2xx status code",
        context: {
          clone: () => ({
            json: async () => ({
              code: "billing_already_active",
              error: "You already have an active or pending plan. Manage it from Settings.",
            }),
          }),
        },
      },
    });

    render(
      <MemoryRouter>
        <StripeEmbeddedCheckout priceId="plus_yearly" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("You already have access")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Go to Settings" })).toHaveAttribute("href", "/settings");
  });

  it("keeps a direct checkout visit safe when the browser payment key is absent", () => {
    payments.configured = false;

    render(
      <MemoryRouter>
        <StripeEmbeddedCheckout priceId="plus_yearly" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Checkout is unavailable")).toBeInTheDocument();
    expect(screen.getByText("Online checkout is unavailable right now. You have not been charged.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("shows a local checkout state when Stripe's browser library cannot load", async () => {
    getStripe.mockRejectedValue(new Error("network unavailable"));

    render(
      <MemoryRouter>
        <StripeEmbeddedCheckout priceId="plus_yearly" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Checkout is unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText("Online checkout is unavailable right now. You have not been charged.")).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("shows the safe local checkout state when session creation rejects", async () => {
    invoke.mockRejectedValue(new Error('network unavailable'));

    render(
      <MemoryRouter>
        <StripeEmbeddedCheckout priceId="plus_yearly" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Checkout is unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText("Online checkout is unavailable right now. You have not been charged.")).toBeInTheDocument();
  });

  it("refuses a session response from a different Stripe environment", async () => {
    invoke.mockResolvedValue({
      data: {
        clientSecret: 'cs_live_should_not_mount',
        environment: 'live',
        priceId: 'plus_yearly',
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <StripeEmbeddedCheckout priceId="plus_yearly" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Checkout needs attention")).toBeInTheDocument();
    });
    expect(screen.getByText("Online checkout is temporarily unavailable while we verify its configuration. You have not been charged.")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("create-checkout", {
      body: { environment: 'sandbox', priceId: 'plus_yearly' },
    });
  });
});
