import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const Privacy = () => (
  <div className="min-h-screen bg-background">
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <CheckCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">PayCheck</span>
        </Link>
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
      </div>
    </nav>

    <div className="container max-w-3xl py-16 space-y-8">
      <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: April 2026</p>

      <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. What we collect</h2>
          <p>When you create a PayCheck account, we collect your email address and first name. When you upload a payslip, we extract structured data such as gross pay, net pay, tax, and deduction amounts. We store the original file and extracted data securely so you can access them later.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. How we use your data</h2>
          <p>We use your payslip data solely to provide PayCheck's core features: payslip analysis, anomaly detection, month-to-month comparison, and issue drafting. We do not sell, rent, or share your personal or financial data with third parties for marketing purposes.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Data storage and security</h2>
          <p>Your data is encrypted in transit (TLS) and at rest. Payslip files and extracted data are stored in secure, access-controlled infrastructure. Only you can access your payslip data through your authenticated account.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Data retention</h2>
          <p>We retain your data for as long as your account is active. If you delete your account, all associated data — including payslip files, extracted data, and profile information — will be permanently deleted within 30 days.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Your rights</h2>
          <p>You can access, export, or delete your data at any time through the Settings page. If you are in the UK or EU, you have rights under GDPR including the right to access, rectify, and erase your personal data.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Cookies</h2>
          <p>PayCheck uses essential cookies only — for authentication and session management. We do not use tracking or advertising cookies.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Contact</h2>
          <p>If you have questions about this privacy policy or your data, please contact us at <span className="text-primary">privacy@paycheck.app</span>.</p>
        </section>
      </div>
    </div>

    <footer className="border-t border-border bg-card py-8">
      <div className="container text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PayCheck. Not tax or legal advice.
      </div>
    </footer>
  </div>
);

export default Privacy;
