import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Onboarding from '@/pages/Onboarding';
import { TooltipProvider } from '@/components/ui/tooltip';

const state = vi.hoisted(() => ({
  from: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => state.navigate,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: state.toast }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: state.from },
}));

function renderPage(initialEntry: string) {
  return render(
    <TooltipProvider>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Onboarding />
        </MemoryRouter>
      </QueryClientProvider>
    </TooltipProvider>,
  );
}

function completeRequiredOnboarding() {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: /United Kingdom/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('radio', { name: 'monthly' }));
  fireEvent.change(screen.getByLabelText(/Employer name/), { target: { value: 'Acme Ltd' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('Onboarding checkout continuation', () => {
  beforeEach(() => {
    state.from.mockReset();
    state.navigate.mockReset();
    state.toast.mockReset();
    state.from.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    });
  });

  it('keeps an allowlisted paid plan when someone skips setup for now', async () => {
    renderPage('/onboarding?checkout=plus_yearly');

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => {
      expect(state.navigate).toHaveBeenCalledWith('/checkout?price=plus_yearly');
    });
  });

  it('resumes a validated checkout return when someone skips setup for now', async () => {
    renderPage('/onboarding?checkout_return=cs_test_checkoutreturn123');

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => {
      expect(state.navigate).toHaveBeenCalledWith('/checkout/return?session_id=cs_test_checkoutreturn123');
    });
  });

  it('resumes a validated checkout return after completing setup', async () => {
    renderPage('/onboarding?checkout_return=cs_test_checkoutreturn123');
    completeRequiredOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Upload your first payslip' }));

    await waitFor(() => {
      expect(state.navigate).toHaveBeenCalledWith('/checkout/return?session_id=cs_test_checkoutreturn123');
    });
  });

  it('drops an unrecognised checkout value and returns to the normal dashboard', async () => {
    renderPage('/onboarding?checkout=anything-else');

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => {
      expect(state.navigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('keeps the customer in setup when skipping cannot save their profile', async () => {
    state.from.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: new Error('profile write failed') }) }),
      insert: () => Promise.resolve({ error: null }),
    });
    renderPage('/onboarding?checkout=plus_yearly');

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => expect(state.toast).toHaveBeenCalledWith({
      title: 'We couldn’t finish setup',
      description: 'Please try again.',
      variant: 'destructive',
    }));
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('does not create an employer record or leave setup when the core profile save fails', async () => {
    const employerInsert = vi.fn();
    state.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: new Error('profile write failed') }) }),
        };
      }
      return { insert: employerInsert };
    });
    renderPage('/onboarding');
    completeRequiredOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Upload your first payslip' }));

    await waitFor(() => expect(state.toast).toHaveBeenCalledWith({
      title: 'We couldn’t finish setup',
      description: 'Please try again.',
      variant: 'destructive',
    }));
    expect(employerInsert).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('finishes setup while making an optional employer-history save failure clear', async () => {
    state.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return { insert: () => Promise.resolve({ error: new Error('employer history unavailable') }) };
    });
    renderPage('/onboarding');
    completeRequiredOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Upload your first payslip' }));

    await waitFor(() => expect(state.toast).toHaveBeenCalledWith({
      title: 'Setup saved',
      description: 'Your profile is ready. You can update your employer later in Settings.',
    }));
    expect(state.navigate).toHaveBeenCalledWith('/vault');
  });

  it('makes the pay-profile requirements clear before Continue becomes available', () => {
    renderPage('/onboarding');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /United Kingdom/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('group', { name: 'Pay frequency *' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'monthly' })).toHaveAttribute('required');
    expect(screen.getByLabelText(/Employer name/)).toHaveAttribute('required');
    expect(screen.getByRole('status')).toHaveTextContent('Choose a pay frequency and enter your employer name to continue.');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'monthly' }));
    fireEvent.change(screen.getByLabelText(/Employer name/), { target: { value: 'Acme Ltd' } });

    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});
