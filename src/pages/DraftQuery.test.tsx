import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DraftQuery from "@/pages/DraftQuery";

const mockUseParams = vi.fn();
const mockUsePayslip = vi.fn();
const mockUseAnomalies = vi.fn();
const mockUseProfile = vi.fn();
const mockUseUsage = vi.fn();
const mockUseToast = vi.fn();
const mockUseAuth = vi.fn();

const { draftFunctionInvoke, draftUpdate, draftUpdateEq } = vi.hoisted(() => ({
  draftFunctionInvoke: vi.fn(),
  draftUpdate: vi.fn(),
  draftUpdateEq: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
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
  PAID_DRAFTS_PER_MONTH: 12,
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
        update: draftUpdate,
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
    mockUseAnomalies.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
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
      draftLimit: 2,
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
    draftUpdate.mockReset();
    draftUpdateEq.mockReset();
    draftUpdate.mockImplementation(() => ({ eq: draftUpdateEq }));
    draftUpdateEq.mockResolvedValue({ error: null });
  });

  it("creates a draft through the server-owned quota check", async () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Back to payslip' })).toHaveAttribute('href', '/payslip/payslip-1');

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

  it('does not send a paid user to an upgrade screen when their paid draft allowance is used', () => {
    mockUseUsage.mockReturnValue({
      accessReady: true,
      accessError: false,
      canDraft: false,
      draftLimit: 12,
      draftsRemaining: 0,
      isPremium: true,
      refetchAccess: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Draft allowance used' })).toBeInTheDocument();
    expect(screen.getByText(/includes up to 12 payroll-message drafts/i)).toBeInTheDocument();
    expect(screen.queryByText('View plans')).not.toBeInTheDocument();
    expect(draftFunctionInvoke).not.toHaveBeenCalled();
  });

  it('does not report a transport failure as a missing payslip before drafting', () => {
    const refetch = vi.fn();
    mockUsePayslip.mockReturnValue({
      data: null,
      error: new Error('network unavailable'),
      isLoading: false,
      refetch,
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'We couldn’t load this payslip.' })).toBeInTheDocument();
    expect(screen.queryByText('Payslip not found.')).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('waits for flagged items before creating a draft, then includes them', async () => {
    mockUseAnomalies.mockReturnValue({ data: [], isLoading: true, isError: false, refetch: vi.fn() });
    const view = renderPage();

    expect(screen.getByRole('heading', { name: 'Loading flagged items' })).toBeInTheDocument();
    expect(draftFunctionInvoke).not.toHaveBeenCalled();

    mockUseAnomalies.mockReturnValue({
      data: [{ payslip_id: 'payslip-1', title: 'Unexpected deduction', description: 'Please confirm this item.' }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <DraftQuery />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(draftFunctionInvoke).toHaveBeenCalledTimes(1);
    });
    const message = await screen.findByLabelText('Message') as HTMLTextAreaElement;
    expect(message.value).toContain('Unexpected deduction');
  });

  it('keeps the local draft available and offers an idempotent retry after creation fails', async () => {
    draftFunctionInvoke.mockRejectedValueOnce(new Error('network unavailable'));
    renderPage();

    expect(await screen.findByText('We couldn’t save this draft yet. Copy it into your email or try again.')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toHaveValue('Clarification on my 1 Apr 2026 payslip');

    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));

    await waitFor(() => {
      expect(draftFunctionInvoke).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
  });

  it('surfaces failed autosaves and lets the customer retry their latest edits', async () => {
    draftUpdateEq.mockResolvedValueOnce({ error: new Error('offline') });
    renderPage();

    const subject = await screen.findByLabelText('Subject');
    await waitFor(() => expect(subject).not.toBeDisabled());
    fireEvent.change(subject, { target: { value: 'Please clarify my deduction' } });

    expect(await screen.findByText('Your latest edits could not be saved. Copy the message before leaving, then try saving again.')).toBeInTheDocument();
    expect(draftUpdate).toHaveBeenCalledWith({
      subject: 'Please clarify my deduction',
      body: expect.any(String),
      status: 'draft',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));

    await waitFor(() => {
      expect(draftUpdate).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
  });
});
