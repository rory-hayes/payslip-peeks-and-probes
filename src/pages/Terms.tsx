import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const Terms = () => (
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
      <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: April 2026</p>

      <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. About PayCheck</h2>
          <p>PayCheck is a payslip checking and issue-spotting tool for employees in the United Kingdom and Ireland. PayCheck provides guidance and highlights potential discrepancies in your payslips. <strong className="text-foreground">PayCheck does not provide formal tax, legal, or payroll advice.</strong> Always confirm findings with your employer or a qualified professional.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. Your account</h2>
          <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use PayCheck.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Acceptable use</h2>
          <p>You may only upload payslips that belong to you. You must not use PayCheck to process other people's financial data without their explicit consent. You must not attempt to reverse-engineer, scrape, or abuse the service.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Data accuracy</h2>
          <p>PayCheck uses automated extraction and rule-based analysis. While we strive for accuracy, we cannot guarantee that all extracted figures or anomaly flags are correct. You should always review extracted data and confirm any issues directly with your employer's payroll team.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Subscriptions and billing</h2>
          <p>PayCheck offers a free tier and a paid Plus plan. Plus subscriptions are billed monthly. You can cancel your subscription at any time through the Settings page — you'll retain access until the end of your billing period. Prices include VAT where applicable.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Limitation of liability</h2>
          <p>PayCheck is provided "as is" without warranty of any kind. We are not liable for any financial decisions you make based on PayCheck's analysis or suggestions. Our total liability is limited to the amount you've paid us in the 12 months preceding any claim.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Termination</h2>
          <p>You can delete your account at any time. We reserve the right to suspend or terminate accounts that violate these terms. Upon deletion, all your data will be permanently removed within 30 days.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Changes to terms</h2>
          <p>We may update these terms from time to time. We'll notify you of material changes via email. Continued use of PayCheck after changes constitutes acceptance of the updated terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
          <p>Questions about these terms? Contact us at <span className="text-primary">support@paycheck.app</span>.</p>
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

export default Terms;
