import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CookieConsent from './CookieConsent';
import { COOKIE_PREFERENCES_EVENT, openCookiePreferences } from '@/lib/cookie-preferences';

const broadcastConsentChange = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
});

vi.mock('@/lib/analytics', () => ({
  broadcastConsentChange,
}));

describe('CookieConsent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage);
    storage.clear();
    broadcastConsentChange.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('offers an equally clear decline choice and saves it without blocking the rest of the app', async () => {
    render(<MemoryRouter><CookieConsent /></MemoryRouter>);

    const dialog = await screen.findByRole('dialog', { name: 'Cookie consent' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-describedby', 'cookie-consent-description');
    expect(document.getElementById('cookie-consent-description')).toHaveTextContent('essential browser storage');
    expect(screen.getByRole('button', { name: 'Decline optional analytics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allow optional analytics' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Decline optional analytics' }));

    expect(storage.getItem('paycheck.cookie_consent')).toBe('declined');
    expect(broadcastConsentChange).toHaveBeenCalledWith('declined');
    expect(screen.queryByRole('dialog', { name: 'Cookie consent' })).not.toBeInTheDocument();
  });

  it('makes the compact close control an explicit decline action', async () => {
    render(<MemoryRouter><CookieConsent /></MemoryRouter>);

    const declineAndClose = await screen.findByRole('button', {
      name: 'Decline optional analytics and close cookie banner',
    });
    fireEvent.click(declineAndClose);

    expect(storage.getItem('paycheck.cookie_consent')).toBe('declined');
    expect(broadcastConsentChange).toHaveBeenCalledWith('declined');
    expect(screen.queryByRole('dialog', { name: 'Cookie consent' })).not.toBeInTheDocument();
  });

  it('does not interrupt a returning visitor who has already made a choice', () => {
    storage.setItem('paycheck.cookie_consent', 'accepted');
    render(<MemoryRouter><CookieConsent /></MemoryRouter>);

    expect(screen.queryByRole('dialog', { name: 'Cookie consent' })).not.toBeInTheDocument();
  });

  it('still offers a session choice when browser storage is restricted', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('Storage access is blocked');
      },
      setItem: () => {
        throw new Error('Storage access is blocked');
      },
    });

    render(<MemoryRouter><CookieConsent /></MemoryRouter>);

    expect(await screen.findByRole('dialog', { name: 'Cookie consent' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Allow optional analytics' }));

    expect(broadcastConsentChange).toHaveBeenCalledWith('accepted');
    expect(screen.queryByRole('dialog', { name: 'Cookie consent' })).not.toBeInTheDocument();
  });

  it('lets a returning visitor reopen the choice and withdraw optional analytics consent', async () => {
    storage.setItem('paycheck.cookie_consent', 'accepted');
    render(<MemoryRouter><CookieConsent /></MemoryRouter>);

    act(() => {
      window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT));
    });

    expect(await screen.findByRole('dialog', { name: 'Cookie consent' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Decline optional analytics' }));

    expect(storage.getItem('paycheck.cookie_consent')).toBe('declined');
    expect(broadcastConsentChange).toHaveBeenCalledWith('declined');
  });

  it('moves focus into reopened preferences and returns it to the trigger after a choice', async () => {
    storage.setItem('paycheck.cookie_consent', 'accepted');
    render(
      <MemoryRouter>
        <CookieConsent />
        <button type="button" onClick={openCookiePreferences}>Privacy choices</button>
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Privacy choices' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Cookie consent' });
    expect(dialog).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Allow optional analytics' }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
