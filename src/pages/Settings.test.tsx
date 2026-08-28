import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  browserTaxReviewProgressStorage,
  exportTaxReviewProgress,
  writeTaxReviewProgress,
} from '@/lib/tax-review-progress';
import Settings from './Settings';

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  toast: vi.fn(),
  portalInvoke: vi.fn(),
  deleteCurrentUserAccount: vi.fn(),
  from: vi.fn(),
  exportFilters: vi.fn(),
  openCookiePreferences: vi.fn(),
  user: null as { id: string; email: string } | null,
  stripeEnvironment: null as 'test' | 'live' | null,
  subscription: {
    plan: 'free',
    status: 'active',
    isPremium: false,
    needsBillingReview: false,
  },
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, signOut: mocks.signOut }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/hooks/use-subscription', () => ({
  useSubscription: () => ({
    subscription: mocks.subscription,
  }),
}));

vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => ({
    automaticChecksUsed: 0,
    uploadsRemaining: 2,
    draftsRemaining: 2,
    isPremium: mocks.subscription.isPremium,
    limits: { automatic_checks_lifetime: 2, drafts_per_month: 2 },
    uploadLimit: mocks.subscription.isPremium ? 6 : 2,
    draftLimit: mocks.subscription.isPremium ? 12 : 2,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    functions: { invoke: mocks.portalInvoke },
  },
}));

vi.mock('@/lib/cookie-preferences', () => ({
  openCookiePreferences: mocks.openCookiePreferences,
}));

vi.mock('@/lib/stripe', () => ({
  getStripeEnvironment: () => mocks.stripeEnvironment,
}));

vi.mock('@/lib/delete-account', () => ({
  AccountDeletionBlockedError: class AccountDeletionBlockedError extends Error {},
  AccountDeletionPendingError: class AccountDeletionPendingError extends Error {},
  deleteCurrentUserAccount: mocks.deleteCurrentUserAccount,
}));

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

const CurrentLocation = () => <output data-testid="location">{useLocation().pathname}</output>;

function installLocalStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => { values.delete(key); },
      setItem: (key: string, value: string) => { values.set(key, String(value)); },
    },
  });
}

function configureExportQueries(failingTable?: string) {
  const responseFor = (table: string) => Promise.resolve({
    data: table === 'profiles'
      ? { user_id: 'user-1', first_name: 'Rory' }
      : table === 'payslips'
        ? [{ id: 'payslip-1', user_id: 'user-1' }]
        : table === 'payslip_extractions'
          ? [{ id: 'extraction-1', payslips: { user_id: 'user-1' } }]
          : table === 'anomaly_results'
            ? [{ id: 'anomaly-1', payslips: { user_id: 'user-1' } }]
            : table === 'payday_plans'
              ? [{
                id: 'plan-1',
                user_id: 'user-1',
                payday_plan_allocations: [{ category: 'essential_bills', amount: 900 }],
              }]
              : [],
    error: table === failingTable ? new Error('database unavailable') : null,
  });

  mocks.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: () => ({
          eq: () => ({ single: () => responseFor(table) }),
        }),
      };
    }
    if (table === 'payslips' || table === 'payday_plans') {
      return {
        select: () => ({
          eq: () => ({ order: () => responseFor(table) }),
        }),
      };
    }
    if (table === 'user_notes' || table === 'issue_drafts' || table === 'employers') {
      return {
        select: () => ({ eq: () => responseFor(table) }),
      };
    }
    if (table === 'payslip_extractions' || table === 'anomaly_results') {
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            mocks.exportFilters(table, column, value);
            return responseFor(table);
          },
        }),
      };
    }
    return { select: () => responseFor(table) };
  });
}

describe('Settings', () => {
  beforeEach(() => {
    installLocalStorage();
    mocks.signOut.mockReset();
    mocks.toast.mockReset();
    mocks.portalInvoke.mockReset();
    mocks.deleteCurrentUserAccount.mockReset();
    mocks.from.mockReset();
    mocks.exportFilters.mockReset();
    mocks.openCookiePreferences.mockReset();
    mocks.user = null;
    mocks.stripeEnvironment = null;
    mocks.subscription = {
      plan: 'free',
      status: 'active',
      isPremium: false,
      needsBillingReview: false,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives every profile and deduction control a semantic accessible name', () => {
    renderSettings();

    expect(screen.getByLabelText('First name')).toHaveAttribute('id', 'settings-first-name');
    expect(screen.getByLabelText('Annual gross salary (£)')).toHaveAttribute('aria-describedby', 'settings-annual-salary-help');
    expect(screen.getByLabelText('Employer name')).toHaveAttribute('id', 'settings-employer-name');
    expect(screen.getByLabelText('Payroll / HR email')).toHaveAttribute('aria-describedby', 'settings-payroll-email-help');

    const countryGroup = screen.getByRole('group', { name: 'Country' });
    expect(within(countryGroup).getByRole('radio', { name: /UK/ })).toBeChecked();
    expect(within(countryGroup).getByRole('radio', { name: /Ireland/ })).not.toBeChecked();

    const frequencyGroup = screen.getByRole('group', { name: 'Pay frequency' });
    expect(within(frequencyGroup).getByRole('radio', { name: 'monthly' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Pension contribution' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Student loan' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('slider', { name: 'Change threshold' })).toHaveValue('5');
    expect(screen.getByRole('button', { name: 'How anomaly sensitivity works' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Automatic checks used on the Free plan' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('progressbar', { name: 'Payroll-message drafts used this month' })).toHaveAttribute('aria-valuemax', '2');
  });

  it('uses native radio controls and labelled switches that remain keyboard-operable', () => {
    renderSettings();

    const countryGroup = screen.getByRole('group', { name: 'Country' });
    const ireland = within(countryGroup).getByRole('radio', { name: /Ireland/ });
    const irelandTarget = document.querySelector<HTMLLabelElement>(`label[for="${ireland.id}"]`);
    expect(irelandTarget).toHaveClass('min-h-11');
    expect(irelandTarget).toHaveClass('peer-focus-visible:ring-2');

    fireEvent.click(irelandTarget!);
    expect(ireland).toBeChecked();
    expect(screen.queryByRole('switch', { name: 'Student loan' })).not.toBeInTheDocument();

    const pension = screen.getByRole('switch', { name: 'Pension contribution' });
    expect(pension).toHaveClass('h-11');
    fireEvent.click(screen.getByText('Pension contribution'));
    expect(pension).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Contribution percentage (%)')).toBeInTheDocument();
  });

  it('shows a labelled confirmation input before deletion', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    expect(screen.getByLabelText(/Type DELETE to confirm/i)).toHaveAttribute('id', 'delete-account-confirmation');
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
    expect(screen.getByText('Tax-review progress saved on this browser')).toBeInTheDocument();
  });

  it('opens the external billing portal without giving it access to the app tab', async () => {
    mocks.subscription = {
      plan: 'plus',
      status: 'active',
      isPremium: true,
      needsBillingReview: false,
    };
    mocks.stripeEnvironment = 'test';
    mocks.portalInvoke.mockResolvedValue({ data: { url: 'https://billing.stripe.com/session/test' }, error: null });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Manage billing' }));

    await waitFor(() => expect(openSpy).toHaveBeenCalledWith(
      'https://billing.stripe.com/session/test',
      '_blank',
      'noopener,noreferrer',
    ));

    openSpy.mockRestore();
  });

  it('lets a customer reopen their optional analytics choice from privacy settings', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Cookie preferences' }));

    expect(mocks.openCookiePreferences).toHaveBeenCalledTimes(1);
  });

  it('exports complete payday plan data, including its saved allocations', async () => {
    mocks.user = { id: 'user-1', email: 'rory@example.com' };
    configureExportQueries();
    writeTaxReviewProgress(
      browserTaxReviewProgressStorage(),
      'user-1',
      'UK',
      '2025/26',
      ['uk-gather'],
      ['uk-gather'],
    );
    let downloadedJson = '';
    class CapturingBlob {
      constructor(parts: unknown[]) {
        downloadedJson = String(parts[0]);
      }
    }
    vi.stubGlobal('Blob', CapturingBlob);
    const createObjectUrl = vi.fn(() => 'blob:export');
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Data exported',
      description: 'Your data has been downloaded as a JSON file.',
    }));

    expect(mocks.from).toHaveBeenCalledWith('payday_plans');
    expect(mocks.exportFilters).toHaveBeenCalledWith('payslip_extractions', 'payslips.user_id', 'user-1');
    expect(mocks.exportFilters).toHaveBeenCalledWith('anomaly_results', 'payslips.user_id', 'user-1');
    expect(JSON.parse(downloadedJson)).toMatchObject({
      payday_plans: [{
        id: 'plan-1',
        payday_plan_allocations: [{ category: 'essential_bills', amount: 900 }],
      }],
      tax_review_progress: [{
        country: 'UK',
        reviewedStepIds: ['uk-gather'],
        taxYearLabel: '2025/26',
      }],
    });

    click.mockRestore();
  });

  it('does not offer a partial export when any protected-data query fails', async () => {
    mocks.user = { id: 'user-1', email: 'rory@example.com' };
    configureExportQueries('payday_plans');
    const createObjectUrl = vi.fn(() => 'blob:export');
    vi.stubGlobal('URL', { createObjectURL: createObjectUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Export failed',
      description: 'Something went wrong. Please try again.',
      variant: 'destructive',
    }));
    expect(createObjectUrl).not.toHaveBeenCalled();

    click.mockRestore();
  });

  it('does not let a profile-load failure overwrite saved settings', async () => {
    mocks.user = { id: 'user-1', email: 'rory@example.com' };
    const update = vi.fn();
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({ single: () => Promise.reject(new Error('network unavailable')) }),
      }),
      update,
    });

    renderSettings();

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your saved settings');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Retry loading settings' })).toBeEnabled();
  });

  it('restores the save action after a profile update transport failure', async () => {
    mocks.user = { id: 'user-1', email: 'rory@example.com' };
    const update = vi.fn(() => ({
      eq: vi.fn(() => Promise.reject(new Error('network unavailable'))),
    }));
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: {
              first_name: 'Rory',
              country: 'UK',
              annual_salary: 45000,
              pay_frequency: 'monthly',
              employer_name: 'Example Ltd',
              payroll_email: null,
              has_pension: false,
              pension_percent: null,
              has_student_loan: false,
              student_loan_plan: null,
              anomaly_threshold_percent: 5,
            },
            error: null,
          }),
        }),
      }),
      update,
    });

    renderSettings();

    const save = await screen.findByRole('button', { name: 'Save changes' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Settings not saved',
      description: 'We could not save your settings. Please try again.',
      variant: 'destructive',
    }));
    expect(save).toBeEnabled();
  });

  it('leaves the settings page after a confirmed deletion even if sign-out cleanup fails', async () => {
    mocks.user = { id: 'user-1', email: 'rory@example.com' };
    mocks.deleteCurrentUserAccount.mockResolvedValue({ billingReviewRequired: false });
    mocks.signOut.mockRejectedValue(new Error('network unavailable'));
    writeTaxReviewProgress(
      browserTaxReviewProgressStorage(),
      'user-1',
      'UK',
      '2025/26',
      ['uk-gather'],
      ['uk-gather'],
    );

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Settings />
        <CurrentLocation />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/i), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => expect(mocks.deleteCurrentUserAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Deletion failed' }));
    expect(exportTaxReviewProgress(browserTaxReviewProgressStorage(), 'user-1')).toEqual([]);
  });

  it('leaves the app after a confirmed deletion and clearly reports a billing follow-up', async () => {
    mocks.user = { id: 'user-1', email: 'rory@example.com' };
    mocks.deleteCurrentUserAccount.mockResolvedValue({ billingReviewRequired: true });

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Settings />
        <CurrentLocation />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/i), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Account removed',
      description: 'Your app data has been removed. A recent payment needs a manual follow-up; please contact support.',
    });
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Deletion failed' }));
  });
});
