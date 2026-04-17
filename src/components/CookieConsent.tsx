import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'paycheck.cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (!v) setVisible(true);
    } catch {
      // localStorage may be unavailable (private mode); do nothing.
    }
  }, []);

  const persist = (value: 'accepted' | 'declined') => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Cookie className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1 text-sm text-muted-foreground">
            <p className="leading-relaxed">
              We use only essential cookies to keep you signed in and to remember this choice. We do not
              use marketing or tracking cookies. Read our{' '}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </div>
          <button
            onClick={() => persist('declined')}
            className="text-muted-foreground hover:text-foreground sm:hidden"
            aria-label="Dismiss cookie banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={() => persist('declined')}>
            Decline non-essential
          </Button>
          <Button size="sm" onClick={() => persist('accepted')}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
