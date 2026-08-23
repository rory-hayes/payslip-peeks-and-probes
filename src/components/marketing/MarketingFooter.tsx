import { Link } from 'react-router';
import { BrandLockup } from '@/components/BrandLockup';
import { openCookiePreferences } from '@/lib/cookie-preferences';

const MarketingFooter = () => (
  <footer className="border-t border-border bg-card py-12">
    <div className="container">
      <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-2">
          <BrandLockup size="sm" />
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/#how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
          <Link to="/guides" className="hover:text-foreground transition-colors">Guides</Link>
          <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <button type="button" onClick={openCookiePreferences} className="hover:text-foreground transition-colors">
            Privacy choices
          </button>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <a href="mailto:support@payslipinsights.com" className="hover:text-foreground transition-colors">Contact</a>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Payslip Insights. Not tax or legal advice.</p>
      </div>
    </div>
  </footer>
);

export default MarketingFooter;
