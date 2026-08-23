import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Cookie, X } from 'lucide-react';
import { broadcastConsentChange } from '@/lib/analytics';
import { COOKIE_PREFERENCES_EVENT } from '@/lib/cookie-preferences';

const STORAGE_KEY = 'paycheck.cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const focusDialogOnOpenRef = useRef(false);

  useEffect(() => {
    const showPreferences = () => {
      const activeElement = document.activeElement;
      returnFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
      focusDialogOnOpenRef.current = true;
      setVisible(true);
    };
    window.addEventListener(COOKIE_PREFERENCES_EVENT, showPreferences);

    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (!v) setVisible(true);
    } catch {
      // A restricted or private browser cannot remember consent, but the
      // visitor must still be able to choose it for this session.
      setVisible(true);
    }

    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, showPreferences);
  }, []);

  useLayoutEffect(() => {
    if (!visible || !focusDialogOnOpenRef.current) return;
    focusDialogOnOpenRef.current = false;
    dialogRef.current?.focus();
  }, [visible]);

  const persist = (value: 'accepted' | 'declined') => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    // Notify the analytics layer (and any other listeners) within this tab.
    broadcastConsentChange(value);
    setVisible(false);

    const returnFocusTarget = returnFocusRef.current;
    returnFocusRef.current = null;
    if (returnFocusTarget?.isConnected) {
      window.setTimeout(() => {
        if (returnFocusTarget.isConnected) returnFocusTarget.focus();
      }, 0);
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
      aria-live="polite"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-xl rounded-[1.35rem] border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:ml-auto sm:mr-0 sm:rounded-2xl sm:p-5">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Cookie className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1 text-sm text-muted-foreground">
            <p id="cookie-consent-description" className="leading-relaxed">
              We use essential browser storage, including local storage, to keep you signed in and remember this choice. If optional,
              privacy-friendly analytics are enabled, you can choose whether we measure visits to public
              pages; payslip and account data are never sent there. Read our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </div>
          <button
            onClick={() => persist('declined')}
            className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:hidden"
            aria-label="Decline optional analytics and close cookie banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 sm:mt-4 sm:justify-end">
          <Button className="min-h-10 flex-[1.55] whitespace-nowrap px-2 text-xs sm:min-h-9 sm:flex-none sm:px-3 sm:text-sm" variant="outline" size="sm" onClick={() => persist('declined')}>
            Decline optional analytics
          </Button>
          <Button className="min-h-10 flex-1 whitespace-nowrap px-2 text-xs sm:min-h-9 sm:flex-none sm:px-3 sm:text-sm" size="sm" onClick={() => persist('accepted')}>
            Allow optional analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
