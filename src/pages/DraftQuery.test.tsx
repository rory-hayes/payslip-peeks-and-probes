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

const draftSelectEq = vi.fn();
const draftSelectOrder = vi.fn();
const draftSelectLimit = vi.fn();
const draftInsert = vi.fn();
const draftInsertSelect = vi.fn();

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
    from: (table: string) => {
      if (table !== "issue_drafts") {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: draftSelectEq,
        })),
        insert: draftInsert,
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
      canDraft: true,
      draftsRemaining: 2,
      isPremium: false,
    });
    mockUseToast.mockReturnValue({ toast: vi.fn() });
    mockUseAuth.mockReturnValue({
      user: { id: "user-123" },
    });

    draftSelectEq.mockReset();
    draftSelectOrder.mockReset();
    draftSelectLimit.mockReset();
    draftInsert.mockReset();
    draftInsertSelect.mockReset();

    draftSelectEq.mockReturnValue({
      eq: vi.fn(() => ({
        order: draftSelectOrder,
      })),
    });
    draftSelectOrder.mockReturnValue({
      limit: draftSelectLimit,
    });
    draftSelectLimit.mockResolvedValue({ data: [], error: null });
    draftInsert.mockReturnValue({
      select: draftInsertSelect,
    });
    draftInsertSelect.mockReturnValue({
      single: vi.fn(async () => ({ data: { id: "draft-1" }, error: null })),
    });
  });

  it("creates a draft record the first time a draft page is opened", async () => {
    renderPage();

    await waitFor(() => {
      expect(draftInsert).toHaveBeenCalled();
    });
  });
});
