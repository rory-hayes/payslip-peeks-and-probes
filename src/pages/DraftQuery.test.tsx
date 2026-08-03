import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DraftQuery from "@/pages/DraftQuery";

const mockUseParams = vi.fn();
const mockUsePayslip = vi.fn();
const mockUseAnomalies = vi.fn();
const mockUseProfile = vi.fn();
const mockUseUsage = vi.fn();
const mockUseToast = vi.fn();
const mockUseAuth = vi.fn();

const { draftFunctionInvoke } = vi.hoisted(() => ({ draftFunctionInvoke: vi.fn() }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    useParams: () => mockUseParams(),
  };
});

vi.mock("@/hooks/use-payslip-data", () => ({
  usePayslip: () => mockUsePayslip(),
  useAnomalies: () => mockUseAnomalies(),
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => mockUseProfile(),
}));

vi.mock("@/hooks/use-usage", () => ({
  useUsage: () => mockUseUsage(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => mockUseToast(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: draftFunctionInvoke },
    from: (table: string) => {
      if (table !== "issue_drafts") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      };
    },
  },
}));

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <DraftQuery />
    </QueryClientProvider>,
  );
}

describe("DraftQuery", () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: "payslip-1" });
    mockUsePayslip.mockReturnValue({
      data: {
        id: "payslip-1",
        pay_date: "2026-04-01",
        employer_name: "Acme",
      },
      isLoading: false,
    });
    mockUseAnomalies.mockReturnValue({ data: [] });
    mockUseProfile.mockReturnValue({
      data: {
        first_name: "Rory",
        payroll_email: "payroll@example.com",
      },
    });
    mockUseUsage.mockReturnValue({
      accessReady: true,
      accessError: false,
      canDraft: true,
      draftsRemaining: 2,
      isPremium: false,
      refetchAccess: vi.fn(),
    });
    mockUseToast.mockReturnValue({ toast: vi.fn() });
    mockUseAuth.mockReturnValue({
      user: { id: "user-123" },
    });

    draftFunctionInvoke.mockReset();
    draftFunctionInvoke.mockResolvedValue({
      data: { draft: { id: "draft-1", subject: null, body: null } },
      error: null,
    });
  });

  it("creates a draft through the server-owned quota check", async () => {
    renderPage();

    await waitFor(() => {
      expect(draftFunctionInvoke).toHaveBeenCalledWith("create-issue-draft", {
        body: {
          payslipId: "payslip-1",
          subject: "Clarification on my 1 Apr 2026 payslip",
          body: expect.any(String),
        },
      });
    });
  });
});
