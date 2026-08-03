import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  extractionInsert: vi.fn(),
  invalidateQueries: vi.fn(),
  invoke: vi.fn(),
  logError: vi.fn(),
  payslipInsert: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '00000000-0000-4000-8000-000000000001' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => ({
    accessError: false,
    accessReady: true,
    canUpload: true,
    uploadsRemaining: 3,
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
    from: (table: string) => {
      if (table === 'payslips') {
        return {
          insert: () => ({
            select: () => ({ single: mocks.payslipInsert }),
          }),
        };
      }

      return { insert: mocks.extractionInsert };
    },
    storage: {
      from: () => ({ upload: mocks.upload, remove: mocks.remove }),
    },
  },
}));

import PayslipUpload from './PayslipUpload';

describe('PayslipUpload processing failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractionInsert.mockResolvedValue({ error: null });
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('processing failed') });
    mocks.payslipInsert.mockResolvedValue({ data: { id: 'payslip-1' }, error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.upload.mockResolvedValue({ error: null });
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
    expect(screen.getByText('Upload failed')).toBeInTheDocument();
    expect(screen.queryByText('Upload complete')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry processing' }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
  });
});
