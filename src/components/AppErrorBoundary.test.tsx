import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppErrorBoundary from '@/components/AppErrorBoundary';

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: mocks.logError,
}));

const ThrowingChild = () => {
  throw new Error('private diagnostic that must not reach the interface');
};

describe('AppErrorBoundary', () => {
  afterEach(() => {
    mocks.logError.mockReset();
    vi.restoreAllMocks();
  });

  it('shows a safe recovery state without rendering a thrown error message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: "Let's get you back on track." })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'contact support' })).toHaveAttribute('href', 'mailto:support@payslipinsights.com');
    await waitFor(() => {
      expect(mocks.logError).toHaveBeenCalledWith('app_render_error', 'A page failed to render');
    });
    expect(screen.queryByText(/private diagnostic/i)).not.toBeInTheDocument();
  });
});
