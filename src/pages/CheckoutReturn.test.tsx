import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutReturn from "@/pages/CheckoutReturn";

const state = vi.hoisted(() => ({
  invoke: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useSearchParams: () => [state.searchParams],
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: state.invoke } },
}));

vi.mock("@/lib/stripe", () => ({
  getStripeEnvironment: () => "sandbox",
}));

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutReturn />
    </QueryClientProvider>,
  );
}

describe("CheckoutReturn", () => {
  beforeEach(() => {
    vi.useRealTimers();
    state.invoke.mockReset();
    state.searchParams = new URLSearchParams("session_id=cs_test_checkoutreturn123");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports success only after the exact server-owned return session is confirmed", async () => {
    state.invoke.mockResolvedValue({
      data: { environment: "sandbox", status: "confirmed" },
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Payment successful!")).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Payment successful!' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Payment confirmed. Your account has been upgraded.');
    expect(state.invoke).toHaveBeenCalledWith("verify-checkout-return", {
      body: { sessionId: "cs_test_checkoutreturn123" },
    });
  });

  it("fails immediately when the return URL has no session id", () => {
    state.searchParams = new URLSearchParams();

    renderPage();

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('We could not confirm this checkout return. Do not submit another payment.');
    expect(state.invoke).not.toHaveBeenCalled();
  });

  it("shows a pending state instead of inviting a second payment while the exact session is unresolved", async () => {
    vi.useFakeTimers();
    state.invoke.mockResolvedValue({
      data: { environment: "sandbox", status: "pending" },
      error: null,
    });

    renderPage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(screen.getByText("Your payment is being confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Payment successful!")).not.toBeInTheDocument();
  });

  it("treats a transport failure as unresolved instead of leaving the payment screen loading forever", async () => {
    vi.useFakeTimers();
    state.invoke.mockRejectedValue(new Error('network unavailable'));

    renderPage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(screen.getByText("Your payment is being confirmed")).toBeInTheDocument();
    expect(state.invoke).toHaveBeenCalledTimes(8);
    expect(screen.queryByText("Payment successful!")).not.toBeInTheDocument();
  });

  it("does not claim success when the browser and server billing environments disagree", async () => {
    state.invoke.mockResolvedValue({
      data: { environment: "live", status: "confirmed" },
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("We need to check this payment")).toBeInTheDocument();
    });
    expect(screen.queryByText("Payment successful!")).not.toBeInTheDocument();
  });
});
