import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const MarketingFooter = () => (
  <footer className="border-t border-border bg-card py-12">
    <div className="container">
      <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <CheckCircle className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">PayCheck</span>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/calculator" className="hover:text-foreground transition-colors">Take-home calculator</Link>
          <Link to="/how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
          <Link to="/guides" className="hover:text-foreground transition-colors">Guides</Link>
          <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <a href="mailto:support@paycheckinsights.com" className="hover:text-foreground transition-colors">Contact</a>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 PayCheck. Not tax or legal advice.</p>
      </div>
    </div>
  </footer>
);

export default MarketingFooter;
