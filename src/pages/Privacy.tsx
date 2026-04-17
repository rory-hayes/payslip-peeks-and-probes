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
          <h2 className="text-lg font-semibold text-foreground">3. Legal basis for processing</h2>
          <p>We process your personal data on the following legal bases under UK GDPR and EU GDPR:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Contract performance</strong> — processing is necessary to provide the PayCheck service you signed up for.</li>
            <li><strong className="text-foreground">Legitimate interest</strong> — anomaly detection and pay-trend analysis serve your interest in verifying your pay is correct.</li>
            <li><strong className="text-foreground">Consent</strong> — you consent to our processing when you create an account and agree to these terms. You may withdraw consent at any time by deleting your account.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Data storage and security</h2>
          <p>Your data is encrypted in transit (TLS 1.2+) and at rest (AES-256). Payslip files are stored in access-controlled cloud storage buckets with row-level security policies that ensure only you can access your own data. Database access is enforced through authenticated sessions — no other user or administrator can view your payslip content.</p>
          <p>We keep your data accurate and up to date. You can review and correct any information held about you at any time through the Settings page.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Data retention and PAYE record keeping</h2>
          <p>We retain your data for as long as your account is active. Under UK PAYE regulations, employers are required to keep payroll records for at least three years after the end of the tax year they relate to (HMRC PAYE guidance). In Ireland, Revenue requires employers to retain payroll records for six years. While PayCheck is not your employer, we recommend keeping your payslip records for at least these periods to support any queries, disputes, or complaints with HMRC or Revenue.</p>
          <p>PayCheck retains your uploaded data for as long as your account exists to support your personal record-keeping obligations. You are responsible for maintaining your own records in line with applicable PAYE requirements.</p>
          <p>If you delete your account, all associated data — including payslip files, extracted data, anomaly results, notes, issue drafts, and profile information — will be permanently and irreversibly deleted within 30 days. We do not retain any data after deletion.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Your data-protection rights</h2>
          <p>If you are in the UK or EU, you have the following rights under UK GDPR / EU GDPR. You can exercise all of these through the Settings page at any time, or by contacting us:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Right of access (Article 15)</strong> — download all your data as a structured JSON file from Settings → Export.</li>
            <li><strong className="text-foreground">Right to rectification (Article 16)</strong> — edit your profile, correct extracted payslip data, and update personal details at any time.</li>
            <li><strong className="text-foreground">Right to erasure (Article 17)</strong> — permanently delete your account and all associated data from Settings → Delete account. Deletion is complete within 30 days.</li>
            <li><strong className="text-foreground">Right to data portability (Article 20)</strong> — export your data in a structured, commonly used, machine-readable format (JSON).</li>
            <li><strong className="text-foreground">Right to restrict processing (Article 18)</strong> — contact us to restrict how we process your data while a concern is investigated.</li>
            <li><strong className="text-foreground">Right to object (Article 21)</strong> — you may object to processing at any time. You can also withdraw consent by deleting your account.</li>
            <li><strong className="text-foreground">Right to lodge a complaint</strong> — you have the right to lodge a complaint with a supervisory authority. In the UK, this is the Information Commissioner's Office (ICO). In Ireland, this is the Data Protection Commission (DPC).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Data processing and third-party processors</h2>
          <p>PayCheck processes payslip data to provide its checking and issue-spotting service. We maintain a record of processing activities as required by Article 30 of the GDPR, which includes: the categories of data processed (payslip financial data, personal identifiers), the purpose of processing (payslip analysis and anomaly detection), the retention period, and the security measures in place.</p>
          <p>Where external services are used to process payslip data (such as AI-based document extraction or cloud infrastructure), they act as data processors on our behalf under written data-processing agreements (DPAs) that comply with Article 28 of the GDPR. These agreements specify:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The subject matter, duration, nature, and purpose of processing</li>
            <li>The types of personal data and categories of data subjects</li>
            <li>The obligations and rights of the controller (PayCheck) and each processor</li>
            <li>Requirements for sub-processor approval, data security, breach notification, audit rights, and data deletion upon termination</li>
          </ul>
          <p>We do not transfer personal data outside the UK/EEA without adequate safeguards (such as Standard Contractual Clauses or an adequacy decision).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Security safeguards</h2>
          <p>We implement the following technical and organisational measures to protect your payslip data:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Encryption in transit</strong> — all traffic between your device and PayCheck is protected with TLS 1.2 or higher. Files cannot be intercepted during upload or download.</li>
            <li><strong className="text-foreground">Encryption at rest</strong> — every payslip file and every database record is encrypted at rest with AES-256 by our infrastructure provider. Disks and backups are encrypted by default.</li>
            <li><strong className="text-foreground">Private file storage</strong> — payslip files are stored in a private storage bucket. There is no public URL. Files can only be retrieved through short-lived, signed download links generated for the authenticated owner.</li>
            <li><strong className="text-foreground">Per-user folder isolation</strong> — each user's files live in a dedicated folder keyed to their account ID. Storage-level access policies enforce that one account cannot read, modify, or delete another account's files, even if a request reaches the storage layer directly.</li>
            <li><strong className="text-foreground">Row-level security on every table</strong> — database policies on payslips, extractions, anomalies, drafts, notes, and audit events all enforce <code className="text-xs">user_id = auth.uid()</code>. Cross-user data access is impossible at the database level.</li>
            <li><strong className="text-foreground">Upload validation</strong> — the storage layer rejects any file over 10 MB or outside the allowed types (PDF, PNG, JPG, WebP). Malformed or oversized uploads are blocked before they touch processing.</li>
            <li><strong className="text-foreground">Authentication</strong> — accounts are protected by industry-standard password hashing and optional Google OAuth. Passwords are checked against the Have I Been Pwned database during sign-up and password change to block known compromised credentials.</li>
            <li><strong className="text-foreground">Service isolation</strong> — AI extraction runs in isolated server-side functions. Extracted financial data is written back only to your own user record. No third party retains your payslip files or extracted data.</li>
            <li><strong className="text-foreground">Audit logging</strong> — key actions (uploads, deletions, exports, account deletion) are recorded in a per-user audit log for security monitoring and to support data-subject access requests.</li>
            <li><strong className="text-foreground">Secure deletion</strong> — when you delete a payslip or your account, files are removed from storage and database records are permanently deleted. Backups follow a rolling retention window and expire within 30 days.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Cookies</h2>
          <p>PayCheck uses essential cookies only — for authentication and session management. We do not use tracking or advertising cookies.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">10. Contact</h2>
          <p>If you have questions about this privacy policy, your data, or wish to exercise any of your rights, please contact us at <span className="text-primary">privacy@paycheck.app</span>.</p>
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
