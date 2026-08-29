import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaxHelper from './TaxHelper';

const state = vi.hoisted(() => ({ isDemo: true, profileCountry: 'UK' as string | null | undefined }));
const clipboardWrite = vi.fn(async () => undefined);

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

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: state.profileCountry === undefined ? undefined : { country: state.profileCountry } }),
}));

vi.mock('@/hooks/use-payslip-data', () => ({
  usePayslips: () => ({ data: [], isError: false, isLoading: false }),
}));

vi.mock('@/contexts/DemoContext', () => ({
  useDemo: () => ({ isDemo: state.isDemo }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

describe('TaxHelper', () => {
  beforeEach(() => {
    state.isDemo = true;
    state.profileCountry = 'UK';
    installLocalStorage();
    clipboardWrite.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with the last completed UK tax year and sample evidence', () => {
    render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Last completed' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'A tax year, organised.' })).toBeInTheDocument();
    expect(screen.getByText(/fictional payslips connect to the official HMRC steps/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3 sample payslips ready' })).toBeInTheDocument();
    expect(screen.getByText(/these fictional figures show how a review can connect saved payslips/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sample 2025/26 review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Could any of these apply to you?' })).toBeInTheDocument();
    expect(screen.getByText('Seen in the sample')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Check the right route before 5 April 2030' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Know what to have ready.' })).toBeInTheDocument();
    expect(screen.getByText(/sample choices reset when you leave/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check eligibility and claim route/i })).toHaveAttribute(
      'href',
      'https://www.gov.uk/guidance/claim-tax-relief-on-your-private-pension-payments',
    );
    expect(screen.getByRole('link', { name: /open sample history/i })).toHaveAttribute('href', '/dashboard#pay-history-heading');
    expect(screen.getByRole('link', { name: /check last year’s income tax/i })).toHaveAttribute('href', 'https://www.gov.uk/check-income-tax-last-year');
  });

  it('switches tax year without implying a refund calculation', () => {
    render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Current year' }));

    expect(screen.getByRole('heading', { name: 'Sample 2026/27 current-year plan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '0 sample payslips ready' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fix current-year details before year-end' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check your current income tax/i })).toHaveAttribute('href', 'https://www.gov.uk/check-income-tax-current-year');
    expect(screen.queryByRole('link', { name: /check last year’s income tax/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Seen in the sample')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guidance, not a refund calculation' })).toBeInTheDocument();
    expect(screen.getByText(/does not calculate your final liability/i)).toBeInTheDocument();
  });

  it('switches the relief scan to Revenue sources for Ireland', () => {
    render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Ireland' }));

    expect(screen.getByRole('heading', { name: 'Rent you paid' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check rent tax credit rules/i })).toHaveAttribute(
      'href',
      'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/land-and-property/rent-credit/index.aspx',
    );
    expect(screen.queryByRole('heading', { name: 'Marriage Allowance' })).not.toBeInTheDocument();
  });

  it('turns selected topics into a private records plan that can be copied', async () => {
    vi.useRealTimers();
    render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    fireEvent.click(screen.getAllByRole('button', { name: 'Add to my review' })[0]);

    expect(screen.getByRole('button', { name: 'In my review' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Pension provider or scheme statement')).toBeInTheDocument();
    expect(screen.getByText(/does not ask you to upload supporting tax documents here/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy my action plan/i }));
      await Promise.resolve();
    });
    expect(clipboardWrite).toHaveBeenCalledOnce();
    expect(clipboardWrite.mock.calls[0][0]).toContain('Pension contributions');
    expect(await screen.findByText('Action plan copied.')).toBeInTheDocument();
  });

  it('keeps demo evidence in the UK but defaults a loading real account to Ireland', () => {
    state.profileCountry = undefined;
    const sample = render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'United Kingdom' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '3 sample payslips ready' })).toBeInTheDocument();
    sample.unmount();

    state.isDemo = false;
    render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Ireland' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Your 2025 review' })).toBeInTheDocument();
  });

  it('tracks checklist progress only after an explicit review action', () => {
    render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /mark as reviewed: bring your confirmed pay together/i }));

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('1 of 5 reviewed')).toBeInTheDocument();
  });

  it('keeps real-account progress on this browser and separates each tax year', () => {
    state.isDemo = false;
    const firstVisit = render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /mark as reviewed: bring your confirmed pay together/i }));
    expect(screen.getByText('Saved on this browser')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    firstVisit.unmount();

    render(<MemoryRouter><TaxHelper /></MemoryRouter>);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('button', { name: /mark as not reviewed: bring your confirmed pay together/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Current year' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Last completed' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('keeps selected review areas with the account, country, and tax year', () => {
    state.isDemo = false;
    const firstVisit = render(<MemoryRouter><TaxHelper /></MemoryRouter>);

    const giftAidCard = screen.getByRole('heading', { name: 'Gift Aid donations' }).closest('article');
    expect(giftAidCard).not.toBeNull();
    fireEvent.click(giftAidCard!.querySelector('button')!);
    expect(screen.getByText('Your choices are saved on this browser.')).toBeInTheDocument();
    firstVisit.unmount();

    render(<MemoryRouter><TaxHelper /></MemoryRouter>);
    const restoredCard = screen.getByRole('heading', { name: 'Gift Aid donations' }).closest('article');
    expect(restoredCard?.querySelector('button')).toHaveTextContent('In my review');

    fireEvent.click(screen.getByRole('button', { name: 'Current year' }));
    const currentCard = screen.getByRole('heading', { name: 'Gift Aid donations' }).closest('article');
    expect(currentCard?.querySelector('button')).toHaveTextContent('Add to my review');

    fireEvent.click(screen.getByRole('button', { name: 'Ireland' }));
    expect(screen.getAllByRole('button', { name: 'Add to my review' }).length).toBeGreaterThan(0);
  });
});
