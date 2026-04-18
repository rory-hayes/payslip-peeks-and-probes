import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const linkClass = (key: typeof active) =>
    active === key
      ? 'text-sm font-medium text-foreground hover:text-primary transition-colors'
      : 'text-sm text-muted-foreground hover:text-foreground transition-colors';

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <CheckCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">PayCheck</span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          <Link to="/calculator" className={linkClass('calculator')}>Calculator</Link>
          <Link to="/how-it-works" className={linkClass('how-it-works')}>How it works</Link>
          <Link to="/guides" className={linkClass('guides')}>Guides</Link>
          <Link to="/pricing" className={linkClass(null)}>Pricing</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/sign-in"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/sign-up"><Button size="sm">Get started</Button></Link>
        </div>
      </div>
    </nav>
  );
};

export default MarketingNav;
