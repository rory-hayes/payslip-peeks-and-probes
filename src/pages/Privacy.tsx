import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BrandLockup } from '@/components/BrandLockup';
import { applySeo } from '@/lib/seo';
import { marketingSeoFor } from '@/lib/marketing-seo-data';

const Privacy = () => {
  useEffect(() => {
    applySeo(marketingSeoFor('/privacy'));
  }, []);

  return (
  <div className="min-h-screen bg-background">
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur" role="navigation" aria-label="Main navigation">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2" aria-label="Payslip Insights home">
          <BrandLockup />
        </Link>
        <Button asChild variant="ghost" size="sm" className="min-h-11 gap-1">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </Link>
        </Button>
      </div>
    </nav>

    <main className="container max-w-3xl py-16 space-y-8">
      <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: August 2026</p>

      <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. Scope</h2>
          <p>Payslip Insights is a payslip review, comparison, record-keeping, and payroll-question service for employees in the United Kingdom and Ireland. This policy explains how the service handles personal data when you use it. It does not make claims about payroll, tax, or legal outcomes.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. What we handle</h2>
          <p>To provide the service, we handle the account details you provide, uploaded payslips, figures extracted from those documents, figures you confirm or edit, and any payroll messages or legacy planning choices you save. A payslip can contain sensitive personal and financial information, so only upload documents you are entitled to use.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Why we use it</h2>
          <p>We use this information to operate the features you request: extracting and presenting payslip figures, showing changes over time, preparing payroll questions, and keeping your tax-year checklist. We may also use limited account and service information to provide support, prevent misuse, and meet applicable legal obligations.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Service providers and document processing</h2>
          <p>We use service providers to run parts of the product, such as authentication, hosting, file storage, and document extraction. When you upload a payslip, the document or the information needed to process it may be sent to the configured document-processing provider. Those providers process information as part of delivering the service; they are not described here as having no access to it.</p>
          <p>Before a public paid launch, we will publish the current provider list, the operating entity, and the relevant contact details.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Access and security</h2>
          <p>The service uses authenticated accounts and technical controls intended to limit access to customer data. No internet service can guarantee complete security. For that reason, you should review your extracted figures before relying on them and avoid sharing your account credentials.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Retention and deletion</h2>
          <p>We keep account and payslip information while it is needed to provide your account and its history. You can request account deletion from within the product. Deletion from live systems, provider systems, and backups can follow different operational timeframes, so we do not promise a universal deletion period in this policy.</p>
          <p>Before public launch, we will publish the retention schedule and the account-deletion process that applies to the live service. Keep your own copies of payslips for your records; Payslip Insights is not your employer or your official payroll record.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Your choices and rights</h2>
          <p>You can review and correct figures before you confirm them in the product. Depending on where you live, data-protection law may also give you rights to request access, correction, deletion, restriction, objection, or portability. Contact us if you want to make such a request; we may need to verify your identity first.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Browser storage, cookies, and similar technology</h2>
          <p>We use essential browser storage, including local storage, to keep you signed in and remember essential product preferences. If optional, privacy-friendly analytics are enabled for a live deployment, we ask for your choice first and measure only visits to selected public pages. That layer is designed not to receive payslip contents, account identifiers, private app routes, URL query strings, or URL fragments.</p>
          <p>Before a public paid launch, we will publish the current analytics provider and any relevant browser-storage or cookie information alongside the wider provider list.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Changes to this policy</h2>
          <p>We may update this policy as the product, its providers, or applicable requirements change. The date at the top shows when it was last updated.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">10. Contact</h2>
          <p>For privacy questions or requests, contact us at <a href="mailto:privacy@payslipinsights.com" className="text-primary hover:underline">privacy@payslipinsights.com</a>.</p>
        </section>
      </div>
    </main>

    <footer className="border-t border-border bg-card py-8">
      <div className="container text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Payslip Insights. Not tax or legal advice.
      </div>
    </footer>
  </div>
  );
};

export default Privacy;
