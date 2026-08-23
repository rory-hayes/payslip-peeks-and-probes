import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PayslipVault from './PayslipVault';

const mocks = vi.hoisted(() => ({
  isError: false,
  refetch: vi.fn(),
}));

vi.mock('@/hooks/use-payslip-data', () => ({
  usePayslips: () => ({ data: [], isError: mocks.isError, isLoading: false, refetch: mocks.refetch }),
}));

vi.mock('@/hooks/use-profile', () => ({
  useCurrency: () => ({ format: (value: number) => `£${value}` }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/components/PayslipUpload', () => ({
  default: () => <div>Upload form</div>,
}));

describe('PayslipVault', () => {
  beforeEach(() => {
    mocks.isError = false;
    mocks.refetch.mockReset();
  });

  it('does not present an unavailable history as an empty vault', () => {
    mocks.isError = true;

    render(
      <MemoryRouter>
        <PayslipVault />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'We couldn’t load your saved payslips.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your first pay check starts here.' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
