import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

const state = vi.hoisted(() => ({
  accessError: false,
  accessPending: false,
  accessReady: true,
  disableDemo: vi.fn(),
  isDemo: true,
  isPremium: true,
  anomaliesError: null as Error | null,
  payslipsError: null as Error | null,
  payslips: [] as Array<Record<string, unknown>>,
  refetchAccess: vi.fn(),
  refetchAnomalies: vi.fn(),
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
    automaticChecksUsed: 0,
    draftsRemaining: 2,
    isPremium: state.isPremium,
    limits: { automatic_checks_lifetime: 2, drafts_per_month: 2 },
    refetchAccess: state.refetchAccess,
    uploadLimit: state.isPremium ? 6 : 2,
    uploadsRemaining: state.isPremium ? 6 : 2,
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
    state.accessError = false;
    state.accessPending = false;
    state.accessReady = true;
    state.disableDemo.mockReset();
    state.isDemo = true;
    state.isPremium = true;
    state.anomaliesError = null;
    state.payslipsError = null;
    state.payslips = [];
    state.refetchAccess.mockReset();
    state.refetchAnomalies.mockReset();
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
    expect(screen.getByRole("region", { name: "Your next actions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ask payroll a clear question." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Keep your tax year on track." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open tax-year helper/i })).toHaveAttribute("href", "/tax-helper");
    expect(screen.getByRole("heading", { name: "What changed from your usual pay?" })).toBeInTheDocument();
    expect(screen.getByText("Your take-home was £137.50 lower than your usual £2,847.50. Based on your last 2 confirmed payslips.")).toBeInTheDocument();
    expect(screen.getByText("Sample data only")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign up free" }));

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
    expect(dialog).toHaveTextContent("What was reviewed");
    expect(dialog).toHaveTextContent("Figures checked against the original");
    expect(dialog).toHaveTextContent("Basic pay");
    expect(dialog).toHaveTextContent("Gross YTD");
    expect(dialog).toHaveTextContent("What to do next");
    expect(dialog).toHaveTextContent("Then build a useful pay history");
    expect(dialog).toHaveTextContent("prepare a clear payroll question");
    expect(dialog).toHaveTextContent("another valid payroll adjustment");
    expect(dialog).not.toHaveTextContent("updated incorrectly");
    expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    expect(container.querySelector("a[href^='/payslip/']")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Keep exploring" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("uses calm customer-facing priority labels instead of internal severity values", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText("High priority")).toBeInTheDocument();
    expect(screen.getByText("Worth checking")).toBeInTheDocument();
    expect(screen.queryByText(/^high$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^medium$/i)).not.toBeInTheDocument();
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

    expect(screen.getByRole("heading", { name: "Confirm your payslip before it joins your history." })).toBeInTheDocument();
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
    expect(screen.getByText('Your two automatic checks are a one-time Free allowance. Payroll-message drafts renew monthly.')).toBeInTheDocument();
    expect(screen.getByLabelText('Automatic checks · Free total: 0 of 2 used')).toBeInTheDocument();
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

  it("offers action-oriented next steps from a confirmed payslip", () => {
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
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /prepare my question/i })).toHaveAttribute("href", "/draft/confirmed-1");
    expect(screen.getByRole("link", { name: /open tax-year helper/i })).toHaveAttribute("href", "/tax-helper");
    expect(screen.queryByRole("link", { name: /plan/i })).not.toBeInTheDocument();
  });
});
