import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const Privacy = () => (
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
      <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: April 2026</p>

      <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. What we collect</h2>
          <p>When you create a PayCheck account, we collect your email address and first name. When you upload a payslip, we extract structured data such as gross pay, net pay, tax, and deduction amounts. We store the original file and extracted data securely so you can access them later.</p>
          <p>We do not collect more information than is necessary to provide our service. We do not process your data for purposes beyond payslip checking and issue spotting.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. How we use your data</h2>
          <p>We use your payslip data solely to provide PayCheck's core features: payslip analysis, anomaly detection, month-to-month comparison, and issue drafting. We do not sell, rent, or share your personal or financial data with third parties for marketing purposes.</p>
          <p>Before processing your data, we inform you how it will be used (through this policy and our sign-up consent). You may withdraw consent at any time by deleting your account.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Data storage and security</h2>
          <p>Your data is encrypted in transit (TLS) and at rest. Payslip files and extracted data are stored in secure, access-controlled infrastructure. Only you can access your payslip data through your authenticated account.</p>
          <p>We keep your data accurate and up to date. You can review and correct any information held about you at any time through the Settings page.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Data retention</h2>
          <p>We retain your data for as long as your account is active. UK employers are required to keep payroll records for at least three years after the end of the tax year they relate to. While PayCheck is not your employer, we recommend keeping your payslip records for at least this period to support any queries or disputes.</p>
          <p>If you delete your account, all associated data — including payslip files, extracted data, anomaly results, and profile information — will be permanently deleted within 30 days.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Your rights</h2>
          <p>You can access, export, correct, or delete your data at any time through the Settings page. If you are in the UK or EU, you have rights under UK GDPR and EU GDPR including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Right of access</strong> — download all your data as JSON from Settings.</li>
            <li><strong className="text-foreground">Right to rectification</strong> — edit your profile and correct extracted payslip data at any time.</li>
            <li><strong className="text-foreground">Right to erasure</strong> — delete your account and all data from Settings.</li>
            <li><strong className="text-foreground">Right to data portability</strong> — export your data in a structured, machine-readable format (JSON).</li>
            <li><strong className="text-foreground">Right to object</strong> — you may withdraw consent to processing at any time by deleting your account.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Data processing</h2>
          <p>PayCheck processes payslip data to provide its checking and issue-spotting service. We maintain a record of processing activities as required by Article 30 of the GDPR, which includes: the categories of data processed (payslip financial data, personal identifiers), the purpose of processing (payslip analysis and anomaly detection), the retention period, and the security measures in place.</p>
          <p>Where external services are used to process payslip data (such as AI-based document extraction), they process data only on our behalf and under contractual obligations that include the subject matter, duration, nature and purpose of processing, data types, and obligations of both parties — in line with Article 28 of the GDPR.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Cookies</h2>
          <p>PayCheck uses essential cookies only — for authentication and session management. We do not use tracking or advertising cookies.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Contact</h2>
          <p>If you have questions about this privacy policy or your data, please contact us at <span className="text-primary">privacy@paycheck.app</span>.</p>
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

export default Privacy;
