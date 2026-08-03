import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

const state = vi.hoisted(() => ({
  disableDemo: vi.fn(),
}));

vi.mock("@/contexts/DemoContext", () => ({
  useDemo: () => ({ disableDemo: state.disableDemo, isDemo: true }),
}));

vi.mock("@/hooks/use-payslip-data", () => ({
  useAnomalies: () => ({ data: [], isLoading: false }),
  usePayslips: () => ({ data: [], isLoading: false }),
  usePayTrends: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-profile", () => ({
  useCurrency: () => ({ currency: "GBP", format: (value: number) => `£${value}`, symbol: "£" }),
  useProfile: () => ({ data: null }),
}));

vi.mock("@/hooks/use-usage", () => ({
  useUsage: () => ({ draftsRemaining: 2, isPremium: true, limits: { drafts_per_month: 2, uploads_per_month: 3 }, uploadsRemaining: 3 }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ExpectedVsActual", () => ({ default: () => null }));
vi.mock("@/components/ExpectedVsActualChart", () => ({ default: () => null }));
vi.mock("@/components/YearToDateSummary", () => ({ default: () => null }));
vi.mock("@/components/YearToDateChart", () => ({ default: () => null }));
vi.mock("@/components/UpgradePrompt", () => ({ default: () => null }));
vi.mock("@/lib/generate-pay-summary-pdf", () => ({ generatePaySummaryPdf: vi.fn() }));

vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

describe("Dashboard demo mode", () => {
  beforeEach(() => state.disableDemo.mockReset());

  it("shows sample data without linking a demo visitor into protected detail routes", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
        <Location />
      </MemoryRouter>,
    );

    expect(screen.getByText("This read-only demo keeps sample payslips on this dashboard.")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-demo-read-only='true']").length).toBeGreaterThan(0);
    expect(container.querySelector("a[href='/vault']")).toBeNull();
    expect(container.querySelector("a[href^='/payslip/']")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sign up to upload" }));

    // The app clears demo state after the public destination mounts. Clearing
    // it on this protected dashboard would race into a /sign-in redirect.
    expect(state.disableDemo).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/sign-up");
  });
});
