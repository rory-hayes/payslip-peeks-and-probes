import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const Terms = () => (
  <div className="min-h-screen bg-background">
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur" role="navigation" aria-label="Main navigation">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2" aria-label="PayCheck home">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <CheckCircle className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold text-foreground">PayCheck</span>
        </Link>
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </Button>
        </Link>
      </div>
    </nav>

    <main className="container max-w-3xl py-16 space-y-8">
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
          <p>PayCheck offers a free tier and paid plans (Plus monthly, Plus yearly, and Founder Lifetime). Subscriptions are billed at the frequency chosen at purchase. You can cancel your subscription at any time through the Settings page — you'll retain access until the end of your billing period. Prices include VAT where applicable.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Data retention, PAYE record keeping, and your obligations</h2>
          <p>Under UK PAYE regulations, employers must keep payroll records for at least three years after the end of the tax year they relate to. In Ireland, Revenue requires employers to retain payroll records for six years. While PayCheck is not your employer, we retain your uploaded payslip data for as long as your account is active to support your personal record keeping.</p>
          <p>We recommend keeping payslip records for at least these retention periods, which may be relevant if you need to query a past payslip, file a complaint with HMRC or Revenue, or support a tax refund claim.</p>
          <p>You are responsible for ensuring your own records meet any applicable legal requirements. PayCheck provides a tool to assist with record keeping but does not guarantee compliance with your specific obligations.</p>
          <p>You can export all your data at any time in a structured format (JSON). On account deletion, all data is permanently and irreversibly removed within 30 days.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Your data-protection rights</h2>
          <p>You have the right to access, correct, export, and delete any information PayCheck holds about you. You can exercise these rights at any time through the Settings page. Specifically:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Access</strong> — download all your data as JSON from Settings.</li>
            <li><strong className="text-foreground">Correction</strong> — edit your profile and personal details at any time.</li>
            <li><strong className="text-foreground">Deletion</strong> — permanently delete your account and all associated data.</li>
            <li><strong className="text-foreground">Portability</strong> — export your data in a machine-readable format.</li>
            <li><strong className="text-foreground">Complaint</strong> — lodge a complaint with the ICO (UK) or DPC (Ireland) if you believe your data rights have been infringed.</li>
          </ul>
          <p>We keep your data secure, accurate, and up to date in accordance with UK and EU data-protection law. We process your data only for the purposes described in our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Security and data protection</h2>
          <p>PayCheck implements encryption (in transit and at rest), row-level security policies, and access controls to protect your data. Your payslip files are stored in isolated, access-controlled storage. Only you can access your data through your authenticated account. Full details of our security measures are set out in our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>
          <p>Where we use third-party services to process your data (such as AI-based document extraction or cloud infrastructure), we have written data-processing agreements in place that comply with UK GDPR and EU GDPR requirements.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Limitation of liability</h2>
          <p>PayCheck is provided "as is" without warranty of any kind. We are not liable for any financial decisions you make based on PayCheck's analysis or suggestions. Our total liability is limited to the amount you've paid us in the 12 months preceding any claim.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">10. Termination</h2>
          <p>You can delete your account at any time. We reserve the right to suspend or terminate accounts that violate these terms. Upon deletion, all your data will be permanently removed within 30 days.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">11. Changes to terms</h2>
          <p>We may update these terms from time to time. We'll notify you of material changes via email. Continued use of PayCheck after changes constitutes acceptance of the updated terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">12. Governing law</h2>
          <p>These terms are governed by the laws of England and Wales. If you are a consumer in Ireland, nothing in these terms affects your rights under Irish consumer protection law.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">13. Contact</h2>
          <p>Questions about these terms? Contact us at <span className="text-primary">support@paycheck.app</span>.</p>
        </section>
      </div>
    </main>

    <footer className="border-t border-border bg-card py-8">
      <div className="container text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PayCheck. Not tax or legal advice.
      </div>
    </footer>
  </div>
);

export default Terms;
