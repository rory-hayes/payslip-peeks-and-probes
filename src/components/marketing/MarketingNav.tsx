import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { BrandLockup } from '@/components/BrandLockup';
import { Menu, X } from 'lucide-react';

interface MarketingNavProps {
  /** Highlight a top-level nav item */
  active?: 'calculator' | 'guides' | 'how-it-works' | null;
}

/**
 * Shared top nav for all logged-out marketing pages: Landing, Calculator,
 * Guides, How it works. Keeping it in one place so every public page surfaces
 * the same set of CTAs and SEO destinations.
 */
const MarketingNav = ({ active = null }: MarketingNavProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const linkClass = (key: typeof active) =>
    active === key
      ? 'text-sm font-medium text-foreground hover:text-primary transition-colors'
      : 'text-sm text-muted-foreground hover:text-foreground transition-colors';

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsMobileMenuOpen(false);
      mobileMenuButtonRef.current?.focus();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileMenuOpen]);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandLockup size="sm" />
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          <Link to="/#how-it-works" className={linkClass('how-it-works')}>How it works</Link>
          <Link to="/guides" className={linkClass('guides')}>Guides</Link>
          <Link to="/pricing" className={linkClass(null)}>Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Button
              ref={mobileMenuButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 md:hidden"
              aria-controls="marketing-mobile-navigation"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
            >
              {isMobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden min-h-11 sm:inline-flex">
              <Link to="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="min-h-11">
              <Link to="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div id="marketing-mobile-navigation" role="group" aria-label="Mobile navigation" className="container pb-3 md:hidden">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-2 shadow-sm">
              <Link to="/#how-it-works" className={`${linkClass('how-it-works')} flex min-h-11 items-center rounded-lg px-3`} onClick={() => setIsMobileMenuOpen(false)}>How it works</Link>
              <Link to="/guides" className={`${linkClass('guides')} flex min-h-11 items-center rounded-lg px-3`} onClick={() => setIsMobileMenuOpen(false)}>Guides</Link>
              <Link to="/pricing" className={`${linkClass(null)} flex min-h-11 items-center rounded-lg px-3`} onClick={() => setIsMobileMenuOpen(false)}>Pricing</Link>
              <Link to="/sign-in" className="flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>Sign in</Link>
            </div>
          </div>
        )}
      </nav>
  );
};

export default MarketingNav;
