import { ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GuideLayoutProps {
  title: string;
  description: string;
  breadcrumbLabel: string;
  children: ReactNode;
}

const GuideLayout = ({ title, description, breadcrumbLabel, children }: GuideLayoutProps) => {
  useEffect(() => {
    document.title = `${title} | Payslip Insights`;
    const meta =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m;
      })();
    meta.setAttribute('content', description);

    // Canonical
    const canonical =
      document.querySelector('link[rel="canonical"]') ||
      (() => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        document.head.appendChild(l);
        return l;
      })();
    canonical.setAttribute('href', window.location.origin + window.location.pathname);
  }, [title, description]);

  return (
    <div className="min-h-screen bg-card">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <CheckCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">PayCheck</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <Link to="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</Link>
            <Link to="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link to="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/guides" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Guides</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/sign-in"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/sign-up"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      <div className="container pt-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link to="/guides" className="hover:text-foreground">Guides</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-foreground">{breadcrumbLabel}</span>
        </nav>
      </div>

      <main className="container max-w-3xl py-10 md:py-14">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="container py-8 text-center text-xs text-muted-foreground">
          <p>
            Payslip Insights provides guidance and issue spotting, not formal tax, payroll, or legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default GuideLayout;
