import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutReturn from "@/pages/CheckoutReturn";

const mockUseSearchParams = vi.fn();
const mockUseSubscription = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useSearchParams: () => mockUseSearchParams(),
  };
});

vi.mock("@/hooks/use-subscription", () => ({
  useSubscription: () => mockUseSubscription(),
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
    vi.useFakeTimers();
    mockUseSubscription.mockReset();
    mockUseSearchParams.mockReset();
  });

  it("does not report success until premium access is confirmed", async () => {
    let isPremium = false;
    const refetch = vi.fn(async () => ({ data: { plan: "free", status: "active", isPremium } }));

    mockUseSubscription.mockImplementation(() => ({
      subscription: { plan: "free", status: "active", isPremium },
      refetch,
    }));
    mockUseSearchParams.mockReturnValue([new URLSearchParams("session_id=test_session")]);

    renderPage();

    expect(screen.getByText("Processing payment…")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(screen.queryByText("Payment successful!")).not.toBeInTheDocument();

    isPremium = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(screen.getByText("Payment successful!")).toBeInTheDocument();
  });

  it("fails immediately when the return URL has no session id", () => {
    mockUseSubscription.mockReturnValue({
      subscription: { plan: "free", status: "active", isPremium: false },
      refetch: vi.fn(),
    });
    mockUseSearchParams.mockReturnValue([new URLSearchParams()]);

    renderPage();

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
