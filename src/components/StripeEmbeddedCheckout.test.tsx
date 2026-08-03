import { useEffect, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

vi.mock("@/lib/stripe", () => ({ getStripe: () => null }));

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
});
