import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaydayPlan } from "@/hooks/use-payday-plan";
import Dashboard from "./Dashboard";

const state = vi.hoisted(() => ({
  activePlan: null as PaydayPlan | null,
  accessError: false,
  accessPending: false,
  accessReady: true,
  disableDemo: vi.fn(),
  isPlanError: false,
  isPlanLoading: false,
  isDemo: true,
  isPremium: true,
  anomaliesError: null as Error | null,
  payslipsError: null as Error | null,
  payslips: [] as Array<Record<string, unknown>>,
  refetchAccess: vi.fn(),
  refetchAnomalies: vi.fn(),
  refetchPaydayPlan: vi.fn(),
  refetchPayslips: vi.fn(),
}));

vi.mock("@/contexts/DemoContext", () => ({
  useDemo: () => ({ disableDemo: state.disableDemo, isDemo: state.isDemo }),
}));

vi.mock("@/hooks/use-payslip-data", () => ({
  useAnomalies: () => ({ data: [], error: state.anomaliesError, isLoading: false, refetch: state.refetchAnomalies }),
  usePayslips: () => ({ data: state.payslips, error: state.payslipsError, isLoading: false, refetch: state.refetchPayslips }),
  usePayTrends: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-profile", () => ({
  useCurrency: () => ({ currency: "GBP", format: (value: number) => `£${value}`, symbol: "£" }),
  useProfile: () => ({ data: null }),
}));

vi.mock("@/hooks/use-usage", () => ({
  useUsage: () => ({
    accessError: state.accessError,
    accessPending: state.accessPending,
    accessReady: state.accessReady,
    draftsRemaining: 2,
    isPremium: state.isPremium,
    limits: { drafts_per_month: 2, uploads_per_month: 3 },
    refetchAccess: state.refetchAccess,
    uploadsRemaining: 3,
  }),
}));

vi.mock("@/hooks/use-payday-plan", () => ({
  useActivePaydayPlan: () => ({
    data: state.activePlan,
    isError: state.isPlanError,
    isLoading: state.isPlanLoading,
    refetch: state.refetchPaydayPlan,
  }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ExpectedVsActual", () => ({ default: () => null }));
vi.mock("@/components/ExpectedVsActualChart", () => ({ default: () => null }));
vi.mock("@/components/NetPayTrendChart", () => ({ default: () => null }));
vi.mock("@/components/YearToDateSummary", () => ({ default: () => null }));
vi.mock("@/components/YearToDateChart", () => ({ default: () => null }));
vi.mock("@/components/UpgradePrompt", () => ({ default: () => null }));
vi.mock("@/lib/generate-pay-summary-pdf", () => ({ generatePaySummaryPdf: vi.fn() }));

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

describe("Dashboard demo mode", () => {
  beforeEach(() => {
    state.activePlan = null;
    state.accessError = false;
    state.accessPending = false;
    state.accessReady = true;
    state.disableDemo.mockReset();
    state.isPlanError = false;
    state.isPlanLoading = false;
    state.isDemo = true;
    state.isPremium = true;
    state.anomaliesError = null;
    state.payslipsError = null;
    state.payslips = [];
    state.refetchAccess.mockReset();
    state.refetchAnomalies.mockReset();
    state.refetchPaydayPlan.mockReset();
    state.refetchPayslips.mockReset();
  });

  it("shows sample data without linking a demo visitor into protected detail routes", async () => {
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
    expect(screen.getByLabelText("Sample payday plan")).toBeInTheDocument();
    expect(screen.getAllByText("Sample allocation")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "What changed from your usual pay?" })).toBeInTheDocument();
    expect(screen.getByText("Your take-home was £137.50 lower than your usual £2,847.50. Based on your last 2 confirmed payslips.")).toBeInTheDocument();
    expect(screen.getByText("Sample data only")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign up to make my plan" }));

    // The demo stays visible until the public page mounts so the route change
    // cannot race into a protected-route redirect.
    expect(state.disableDemo).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/sign-up");

    fireEvent.click(screen.getByRole("button", { name: "Sign up to upload" }));

    // The app clears demo state after the public destination mounts. Clearing
    // it on this protected dashboard would race into a /sign-in redirect.
    expect(state.disableDemo).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/sign-up");
    await waitFor(() => expect(container.querySelector(".pi-dashboard__chart-loading")).not.toBeInTheDocument());
  });

  it("opens a useful but account-safe sample preview from the dashboard", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
        <Location />
      </MemoryRouter>,
    );

    const previewButton = screen.getByRole("button", { name: "Open sample payslip preview" });
    expect(previewButton).toHaveTextContent("Review sample payslip");

    fireEvent.click(previewButton);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Sample payslip check");
    expect(dialog).toHaveTextContent("Tax increased more than expected");
    expect(dialog).toHaveTextContent("What to do next");
    expect(dialog).toHaveTextContent("Then turn confirmed pay into a payday plan");
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    expect(container.querySelector("a[href^='/payslip/']")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Keep exploring" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps extracted figures out of the dashboard until the user confirms them", () => {
    state.isDemo = false;
    state.payslips = [{
      anomaly_count: 0,
      country: "UK",
      employer_name: "Example Ltd",
      file_name: "payslip.pdf",
      gross_pay: 2200,
      id: "review-1",
      net_pay: 1500,
      pay_date: "2026-08-01",
      pay_period_end: "2026-08-01",
      pay_period_start: "2026-07-01",
      status: "extracted",
      tax_amount: 400,
      total_deductions: 700,
    }];

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Confirm your payslip before you plan." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /check the details/i })).toHaveAttribute("href", "/vault?review=review-1");
    expect(screen.queryByText("£1500")).not.toBeInTheDocument();
  });

  it('never presents a data-load failure as an empty payslip account', () => {
    state.isDemo = false;
    state.payslipsError = new Error('network unavailable');

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'We couldn’t load your latest pay data.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Just got paid?' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.refetchPayslips).toHaveBeenCalledTimes(1);
    expect(state.refetchAnomalies).toHaveBeenCalledTimes(1);
  });

  it('withholds free usage facts while account access is still loading', () => {
    state.isDemo = false;
    state.isPremium = false;
    state.accessReady = false;
    state.accessPending = true;
    state.payslips = [{
      anomaly_count: 0,
      country: 'UK',
      employer_name: 'Example Ltd',
      file_name: 'payslip.pdf',
      gross_pay: 2200,
      id: 'confirmed-1',
      net_pay: 1500,
      pay_date: '2026-08-01',
      pay_period_end: '2026-08-01',
      pay_period_start: '2026-07-01',
      status: 'confirmed',
      tax_amount: 400,
      total_deductions: 700,
    }];

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Checking account access' })).toBeInTheDocument();
    expect(screen.getByText('Checking your account access')).toBeInTheDocument();
    expect(screen.queryByText('Free plan usage')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Upgrade' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Automatic checks:/)).not.toBeInTheDocument();
  });

  it('withholds usage and upgrade claims when account access cannot be verified', () => {
    state.isDemo = false;
    state.isPremium = false;
    state.accessReady = false;
    state.accessError = true;
    state.payslips = [{
      anomaly_count: 0,
      country: 'UK',
      employer_name: 'Example Ltd',
      file_name: 'payslip.pdf',
      gross_pay: 2200,
      id: 'confirmed-1',
      net_pay: 1500,
      pay_date: '2026-08-01',
      pay_period_end: '2026-08-01',
      pay_period_start: '2026-07-01',
      status: 'confirmed',
      tax_amount: 400,
      total_deductions: 700,
    }];

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert', { name: 'Account access check failed' })).toBeInTheDocument();
    expect(screen.getByText('We couldn’t verify your account access')).toBeInTheDocument();
    expect(screen.queryByText('Free plan usage')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Upgrade' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.refetchAccess).toHaveBeenCalledTimes(1);
  });

  it('shows free usage once account access is confirmed', () => {
    state.isDemo = false;
    state.isPremium = false;
    state.payslips = [{
      anomaly_count: 0,
      country: 'UK',
      employer_name: 'Example Ltd',
      file_name: 'payslip.pdf',
      gross_pay: 2200,
      id: 'confirmed-1',
      net_pay: 1500,
      pay_date: '2026-08-01',
      pay_period_end: '2026-08-01',
      pay_period_start: '2026-07-01',
      status: 'confirmed',
      tax_amount: 400,
      total_deductions: 700,
    }];

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Free plan usage' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upgrade' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByLabelText('Automatic checks: 0 of 3 used')).toBeInTheDocument();
  });

  it("links a real user from a usual-pay insight to the closest confirmed comparison", () => {
    state.isDemo = false;
    state.payslips = [
      {
        anomaly_count: 0,
        country: "UK",
        employer_name: "Example Ltd",
        file_name: "jan.pdf",
        gross_pay: 2200,
        id: "confirmed-jan",
        net_pay: 1600,
        pay_date: "2026-01-31",
        pay_period_end: "2026-01-31",
        pay_period_start: "2026-01-01",
        status: "confirmed",
        tax_amount: 400,
        total_deductions: 600,
      },
      {
        anomaly_count: 0,
        country: "UK",
        employer_name: "Example Ltd",
        file_name: "feb.pdf",
        gross_pay: 2200,
        id: "confirmed-feb",
        net_pay: 1600,
        pay_date: "2026-02-28",
        pay_period_end: "2026-02-28",
        pay_period_start: "2026-02-01",
        status: "confirmed",
        tax_amount: 400,
        total_deductions: 600,
      },
      {
        anomaly_count: 0,
        country: "UK",
        employer_name: "Example Ltd",
        file_name: "mar.pdf",
        gross_pay: 2200,
        id: "confirmed-mar",
        net_pay: 1500,
        pay_date: "2026-03-31",
        pay_period_end: "2026-03-31",
        pay_period_start: "2026-03-01",
        status: "confirmed",
        tax_amount: 500,
        total_deductions: 700,
      },
    ];

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "What changed from your usual pay?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /compare the figures/i })).toHaveAttribute(
      "href",
      "/compare?current=confirmed-mar&previous=confirmed-feb",
    );
  });

  it("shows the current saved payday plan only when it belongs to the latest confirmed payslip", () => {
    state.isDemo = false;
    state.payslips = [{
      anomaly_count: 0,
      country: "UK",
      employer_name: "Example Ltd",
      file_name: "payslip.pdf",
      gross_pay: 2200,
      id: "confirmed-1",
      net_pay: 1500,
      pay_date: "2026-08-01",
      pay_period_end: "2026-08-01",
      pay_period_start: "2026-07-01",
      status: "confirmed",
      tax_amount: 400,
      total_deductions: 700,
    }];
    state.activePlan = {
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      currency: "GBP",
      everydayCheckedInAt: null,
      everydayRemaining: null,
      id: "plan-1",
      netPay: 1500,
      nextPayday: "2999-01-01",
      payDate: "2026-08-01",
      payslipId: "confirmed-1",
      status: "active",
      updatedAt: "2026-08-03T12:00:00Z",
    };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText("Everyday amount in this plan")).toBeInTheDocument();
    expect(screen.getByText("£250.00")).toBeInTheDocument();
    expect(screen.getByText("Days to next payday")).toBeInTheDocument();
    expect(screen.getByText("1 Jan 2999")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open my plan/i })).toHaveAttribute("href", "/plan");
    expect(screen.getByRole("heading", { name: "Weekly plan pulse" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add a check-in/i })).toHaveAttribute("href", "/plan#payday-check-in");
    expect(screen.getByText("Planned amounts, not a live balance or financial advice.")).toBeInTheDocument();
  });

  it('does not present a missing plan when the saved-plan check fails', () => {
    state.isDemo = false;
    state.isPlanError = true;
    state.payslips = [{
      anomaly_count: 0,
      country: 'UK',
      employer_name: 'Example Ltd',
      file_name: 'payslip.pdf',
      gross_pay: 2200,
      id: 'confirmed-1',
      net_pay: 1500,
      pay_date: '2026-08-01',
      pay_period_end: '2026-08-01',
      pay_period_start: '2026-07-01',
      status: 'confirmed',
      tax_amount: 400,
      total_deductions: 700,
    }];
    state.activePlan = {
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      currency: 'GBP',
      everydayCheckedInAt: null,
      everydayRemaining: null,
      id: 'plan-1',
      netPay: 1500,
      nextPayday: '2999-01-01',
      payDate: '2026-08-01',
      payslipId: 'confirmed-1',
      status: 'active',
      updatedAt: '2026-08-03T12:00:00Z',
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('We couldn’t check your saved plan.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /start my plan/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Everyday amount in this plan')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.refetchPaydayPlan).toHaveBeenCalledTimes(1);
  });

  it("does not offer a check-in destination when no everyday amount was planned", () => {
    state.isDemo = false;
    state.payslips = [{
      anomaly_count: 0,
      country: "UK",
      employer_name: "Example Ltd",
      file_name: "payslip.pdf",
      gross_pay: 2200,
      id: "confirmed-1",
      net_pay: 1500,
      pay_date: "2026-08-01",
      pay_period_end: "2026-08-01",
      pay_period_start: "2026-07-01",
      status: "confirmed",
      tax_amount: 400,
      total_deductions: 700,
    }];
    state.activePlan = {
      allocations: { essentialBills: 800, everydaySpending: 0, buffer: 125 },
      currency: "GBP",
      everydayCheckedInAt: null,
      everydayRemaining: null,
      id: "plan-1",
      netPay: 1500,
      nextPayday: "2999-01-01",
      payDate: "2026-08-01",
      payslipId: "confirmed-1",
      status: "active",
      updatedAt: "2026-08-03T12:00:00Z",
    };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("heading", { name: /plan pulse/i })).not.toBeInTheDocument();
    expect(document.querySelector("a[href='/plan#payday-check-in']")).toBeNull();
  });

  it("keeps the start-plan state when a saved plan belongs to an older payslip", () => {
    state.isDemo = false;
    state.payslips = [{
      anomaly_count: 0,
      country: "UK",
      employer_name: "Example Ltd",
      file_name: "payslip.pdf",
      gross_pay: 2200,
      id: "confirmed-1",
      net_pay: 1500,
      pay_date: "2026-08-01",
      pay_period_end: "2026-08-01",
      pay_period_start: "2026-07-01",
      status: "confirmed",
      tax_amount: 400,
      total_deductions: 700,
    }];
    state.activePlan = {
      allocations: { essentialBills: 800, everydaySpending: 250, buffer: 125 },
      currency: "GBP",
      everydayCheckedInAt: null,
      everydayRemaining: null,
      id: "plan-older",
      netPay: 1500,
      nextPayday: "2999-01-01",
      payDate: "2026-07-01",
      payslipId: "confirmed-older",
      status: "active",
      updatedAt: "2026-08-03T12:00:00Z",
    };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /start my plan/i })).toHaveAttribute("href", "/plan");
    expect(screen.queryByText("Everyday amount in this plan")).not.toBeInTheDocument();
  });
});
