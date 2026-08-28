import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  extractionInsert: vi.fn(),
  extractionSelect: vi.fn(),
  invalidateQueries: vi.fn(),
  invoke: vi.fn(),
  logError: vi.fn(),
  payslipSelect: vi.fn(),
  profileSelect: vi.fn(),
  rpc: vi.fn(),
  toast: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '00000000-0000-4000-8000-000000000001' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => ({
    accessError: false,
    accessReady: true,
    canUpload: true,
    uploadsRemaining: 2,
    uploadLimit: 2,
    uploadQuotaScope: 'lifetime',
    isPremium: false,
    refetchAccess: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('@/lib/logger', () => ({
  logError: mocks.logError,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
    from: (table: string) => {
      if (table === 'payslips') {
        return {
          select: () => ({
            eq: () => ({ single: mocks.payslipSelect }),
          }),
        };
      }

      if (table === 'payslip_extractions') {
        return {
          insert: mocks.extractionInsert,
          select: () => ({
            eq: () => ({ single: mocks.extractionSelect }),
          }),
        };
      }

      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mocks.profileSelect }),
          }),
        };
      }

      return { insert: mocks.extractionInsert };
    },
    storage: {
      from: () => ({ uploadToSignedUrl: mocks.uploadToSignedUrl }),
    },
  },
}));

import PayslipUpload from './PayslipUpload';

describe('PayslipUpload processing failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractionSelect.mockResolvedValue({ data: null, error: new Error('not requested') });
    mocks.extractionInsert.mockResolvedValue({ error: null });
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.invoke.mockImplementation(async (name: string) => {
      if (name === 'start-payslip-upload') {
        return {
          data: {
            sessionId: '00000000-0000-4000-8000-000000000002',
            path: '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.bin',
            token: 'temporary-upload-token-with-safe-length',
            contentType: 'application/pdf',
            expiresAt: '2026-08-04T12:00:00.000Z',
          },
          error: null,
        };
      }
      if (name === 'finish-payslip-upload') return { data: { payslipId: 'payslip-1' }, error: null };
      if (name === 'process-payslip') return { data: null, error: new Error('processing failed') };
      return { data: null, error: new Error('not requested') };
    });
    mocks.payslipSelect.mockResolvedValue({ data: null, error: new Error('not requested') });
    mocks.profileSelect.mockResolvedValue({ data: null, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.uploadToSignedUrl.mockResolvedValue({ error: null });
  });

  it('shows a retryable failure instead of a completed upload when processing fails', async () => {
    const { container } = render(
      <MemoryRouter>
        <PayslipUpload />
      </MemoryRouter>,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['content'], 'April payslip.pdf', { type: 'application/pdf' })] },
    });

    expect(await screen.findByRole('button', { name: 'Retry processing' })).toBeInTheDocument();
    expect(screen.getByText('Payslip needs another step')).toBeInTheDocument();
    expect(screen.queryByText('Payslip saved')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry processing' }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('process-payslip', { body: { payslip_id: 'payslip-1' } }));
  });

  it('explains the document-processing boundary before a person chooses a payslip', () => {
    render(
      <MemoryRouter>
        <PayslipUpload />
      </MemoryRouter>,
    );

    expect(screen.getByText(/OpenAI provides the AI-assisted first transcription/i)).toBeInTheDocument();
    expect(screen.getByText(/stored privately with Supabase and sent directly from our server to the OpenAI API/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How we handle your information' })).toHaveAttribute('href', '/privacy');
  });

  it('reopens only a server-confirmed review without dispatching another provider check', async () => {
    mocks.payslipSelect.mockResolvedValue({
      data: { country: 'UK', pay_date: '2026-08-01', status: 'needs_review' },
      error: null,
    });
    mocks.extractionSelect.mockResolvedValue({
      data: {
        gross_pay: 2200,
        national_insurance_amount: 120,
        net_pay: 1600,
        tax_amount: 400,
        total_deductions: 600,
        confidence_score: 0.9,
        year_to_date_json: { gross_pay: 6600, tax: 1200, ni: 360, pension: 150 },
        normalized_json: {
          confidence: 'high',
          line_items: [{
            label: 'Basic pay',
            kind: 'earning',
            amount: 2200,
            year_to_date_amount: 6600,
            evidence: 'Basic pay £2,200.00',
            confidence: 'high',
          }],
          field_evidence: [{ field: 'gross_pay', evidence: 'Gross pay £2,200.00', confidence: 'high' }],
        },
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <PayslipUpload resumeReviewId="review-1" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Check the details.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm my payslip' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('1600')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Check the payslip rows' })).toBeInTheDocument();
    expect(screen.getByText('Basic pay')).toBeInTheDocument();
    expect(screen.getByText('Gross YTD')).toBeInTheDocument();
    expect(mocks.invoke).not.toHaveBeenCalledWith('process-payslip', expect.anything());
  });

  it('returns to an actionable upload state if reopening a saved review loses connection', async () => {
    mocks.payslipSelect.mockRejectedValue(new Error('network unavailable'));

    render(
      <MemoryRouter>
        <PayslipUpload resumeReviewId="review-1" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Upload a payslip' })).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'This review is not available',
      description: 'It may already be confirmed, or it could not be opened. Refresh your vault and try again.',
      variant: 'destructive',
    });
    expect(screen.queryByText('Opening your review…')).not.toBeInTheDocument();
  });

  it('returns a recoverable error instead of leaving upload in progress when issuing a secure upload rejects', async () => {
    mocks.invoke.mockRejectedValue(new Error('network unavailable'));
    const { container } = render(
      <MemoryRouter>
        <PayslipUpload />
      </MemoryRouter>,
    );

    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['content'], 'April payslip.pdf', { type: 'application/pdf' })] },
    });

    expect(await screen.findByRole('heading', { name: 'Upload failed' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't complete that upload. Please try again");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.queryByText('Uploading…')).not.toBeInTheDocument();
  });

  it('settles the server-owned upload session before retrying when storage rejects', async () => {
    mocks.uploadToSignedUrl.mockRejectedValue(new Error('network unavailable'));
    const { container } = render(
      <MemoryRouter>
        <PayslipUpload />
      </MemoryRouter>,
    );

    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['content'], 'April payslip.pdf', { type: 'application/pdf' })] },
    });

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('finish-payslip-upload', {
      body: { sessionId: '00000000-0000-4000-8000-000000000002' },
    }));
    expect(await screen.findByRole('button', { name: 'Retry processing' })).toBeInTheDocument();
  });

  it('offers a safe manual review after a failed automatic check', async () => {
    mocks.payslipSelect.mockResolvedValue({
      data: {
        country: null,
        file_name: 'April payslip.pdf',
        status: 'needs_review',
      },
      error: null,
    });
    mocks.profileSelect.mockResolvedValue({ data: { country: 'UK' }, error: null });
    mocks.invoke.mockImplementation(async (name: string) => {
      if (name === 'start-payslip-upload') {
        return {
          data: {
            sessionId: '00000000-0000-4000-8000-000000000002',
            path: '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.bin',
            token: 'temporary-upload-token-with-safe-length',
            contentType: 'application/pdf',
            expiresAt: '2026-08-04T12:00:00.000Z',
          },
          error: null,
        };
      }
      if (name === 'finish-payslip-upload') return { data: { payslipId: 'payslip-1' }, error: null };
      if (name === 'process-payslip') return { data: null, error: new Error('processing failed') };
      if (name === 'get-payslip-original-url') return { data: { url: 'https://storage.example.test/manual-payslip' }, error: null };
      return { data: null, error: new Error('not requested') };
    });

    const { container } = render(
      <MemoryRouter>
        <PayslipUpload />
      </MemoryRouter>,
    );
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['content'], 'April payslip.pdf', { type: 'application/pdf' })] },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Enter figures manually' }));

    expect(await screen.findByRole('heading', { name: 'Check the details.' })).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith('begin_manual_payslip_review', { p_payslip_id: 'payslip-1' });
    expect(screen.getByLabelText(/Gross pay/)).toHaveValue(null);
    expect(await screen.findByRole('link', { name: 'Open original payslip' })).toHaveAttribute(
      'href',
      'https://storage.example.test/manual-payslip',
    );
    expect(mocks.invoke).toHaveBeenCalledWith('get-payslip-original-url', { body: { payslipId: 'payslip-1' } });
  });

  it('only signals upload completion after the person confirms the review', async () => {
    const onUploadComplete = vi.fn();
    mocks.invoke.mockImplementation(async (name: string) => {
      if (name === 'start-payslip-upload') {
        return {
          data: {
            sessionId: '00000000-0000-4000-8000-000000000002',
            path: '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.bin',
            token: 'temporary-upload-token-with-safe-length',
            contentType: 'application/pdf',
            expiresAt: '2026-08-04T12:00:00.000Z',
          },
          error: null,
        };
      }
      if (name === 'finish-payslip-upload') return { data: { payslipId: 'payslip-1' }, error: null };
      if (name === 'process-payslip') return { data: { anomalies_found: 0, extraction: {} }, error: null };
      return { data: null, error: new Error('not requested') };
    });
    mocks.payslipSelect.mockResolvedValue({
      data: {
        country: 'UK',
        file_name: 'April payslip.pdf',
        pay_date: '2026-08-01',
        status: 'needs_review',
      },
      error: null,
    });
    mocks.extractionSelect.mockResolvedValue({
      data: {
        gross_pay: 2200,
        national_insurance_amount: 120,
        net_pay: 1600,
        tax_amount: 400,
        total_deductions: 600,
      },
      error: null,
    });

    const { container } = render(
      <MemoryRouter>
        <PayslipUpload onUploadComplete={onUploadComplete} />
      </MemoryRouter>,
    );
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['content'], 'April payslip.pdf', { type: 'application/pdf' })] },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm my payslip' }));
    expect(onUploadComplete).not.toHaveBeenCalled();

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith('payslip-1'));
    expect(screen.getByText('Payslip confirmed')).toBeInTheDocument();
  });

  it('shows inline required-field errors and focuses the first missing review field', async () => {
    mocks.payslipSelect.mockResolvedValue({
      data: {
        country: 'UK',
        file_name: 'April payslip.pdf',
        pay_date: null,
        status: 'needs_review',
      },
      error: null,
    });
    mocks.extractionSelect.mockResolvedValue({
      data: {
        gross_pay: null,
        net_pay: null,
        tax_amount: null,
        total_deductions: null,
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <PayslipUpload resumeReviewId="review-missing-values" />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm my payslip' }));

    expect(await screen.findByText('Enter the pay date shown on your payslip.')).toBeInTheDocument();
    expect(screen.getByText('Enter a gross pay amount greater than zero.')).toBeInTheDocument();
    expect(screen.getByText('Enter a net pay amount greater than zero.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Pay date/)).toHaveFocus());
  });

  it('requires the detailed rows to be checked before they can join confirmed history', async () => {
    mocks.payslipSelect.mockResolvedValue({
      data: {
        country: 'UK',
        file_name: 'April payslip.pdf',
        pay_date: '2026-08-01',
        status: 'needs_review',
      },
      error: null,
    });
    mocks.extractionSelect.mockResolvedValue({
      data: {
        gross_pay: 2200,
        net_pay: 1600,
        tax_amount: 400,
        total_deductions: 600,
        normalized_json: {
          currency: 'GBP',
          line_items: [{
            label: 'Basic pay',
            kind: 'earning',
            amount: 2200,
            year_to_date_amount: 6600,
            evidence: 'Basic pay £2,200.00',
            confidence: 'high',
          }],
        },
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <PayslipUpload resumeReviewId="review-detailed-rows" />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm my payslip' }));

    expect(await screen.findByText('Confirm that you checked these detailed rows against the original payslip.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /I checked these rows against the original/i })).toHaveFocus();
    expect(mocks.rpc).not.toHaveBeenCalledWith('confirm_payslip_review', expect.anything());
  });

  it('sends corrected and added rows through the atomic confirmation call', async () => {
    mocks.payslipSelect.mockResolvedValue({
      data: {
        country: 'UK',
        file_name: 'April payslip.pdf',
        pay_date: '2026-08-01',
        status: 'needs_review',
      },
      error: null,
    });
    mocks.extractionSelect.mockResolvedValue({
      data: {
        gross_pay: 2200,
        net_pay: 1600,
        tax_amount: 400,
        total_deductions: 600,
        normalized_json: {
          currency: 'GBP',
          line_items: [{
            label: 'Basic pay',
            kind: 'earning',
            amount: 2200,
            year_to_date_amount: 6600,
            evidence: 'Basic pay £2,200.00',
            confidence: 'high',
          }],
        },
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <PayslipUpload resumeReviewId="review-corrected-rows" />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Basic pay' }));
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Basic salary' } });
    fireEvent.change(screen.getByLabelText('This payslip'), { target: { value: '2250.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add a missing row' }));
    const descriptions = screen.getAllByLabelText('Description');
    fireEvent.change(descriptions.at(-1) as HTMLInputElement, { target: { value: 'Cycle to Work' } });
    const typePickers = screen.getAllByLabelText('Type');
    fireEvent.change(typePickers.at(-1) as HTMLSelectElement, { target: { value: 'deduction' } });
    const currentAmounts = screen.getAllByLabelText('This payslip');
    fireEvent.change(currentAmounts.at(-1) as HTMLInputElement, { target: { value: '35' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I checked these rows against the original/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm my payslip' }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('confirm_payslip_review', expect.objectContaining({
      p_line_items: [
        {
          source_index: 0,
          label: 'Basic salary',
          kind: 'earning',
          amount: 2250.5,
          year_to_date_amount: 6600,
        },
        {
          source_index: null,
          label: 'Cycle to Work',
          kind: 'deduction',
          amount: 35,
          year_to_date_amount: null,
        },
      ],
    })));
  });

  it('lets a reviewer correct the payslip country before saving', async () => {
    mocks.payslipSelect.mockResolvedValue({
      data: {
        country: 'UK',
        file_name: 'April payslip.pdf',
        pay_date: '2026-08-01',
        status: 'needs_review',
      },
      error: null,
    });
    mocks.extractionSelect.mockResolvedValue({
      data: {
        gross_pay: 2200,
        national_insurance_amount: 120,
        net_pay: 1600,
        tax_amount: 400,
        total_deductions: 600,
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <PayslipUpload resumeReviewId="review-country-correction" />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Ireland' }));

    expect(screen.getByRole('button', { name: 'Ireland' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('PRSI')).toBeInTheDocument();
    expect(screen.queryByLabelText('National Insurance')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm my payslip' }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith(
      'confirm_payslip_review',
      expect.objectContaining({ p_country: 'Ireland' }),
    ));
  });
});
