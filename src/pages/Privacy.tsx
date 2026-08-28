import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BrandLockup } from '@/components/BrandLockup';
import { applySeo } from '@/lib/seo';
import { marketingSeoFor } from '@/lib/marketing-seo-data';
import { publicLegalDetails } from '@/lib/public-legal-details';

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
          {publicLegalDetails.configured ? (
            <p>The data controller for this service is <strong className="text-foreground">{publicLegalDetails.operatorName}</strong>, at {publicLegalDetails.operatorAddress}.</p>
          ) : (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950" data-release-blocker="legal-operator">This is a pre-release build. Its operator details are not configured, so the production app does not accept real payslip uploads.</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. What we handle</h2>
          <p>To provide the service, we handle the account details you provide, uploaded payslips, figures extracted from those documents, figures you confirm or edit, and any payroll messages or legacy planning choices you save. A payslip can contain sensitive personal and financial information, so only upload documents you are entitled to use.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Why we use it</h2>
          <p>We use this information to operate the features you request: extracting and presenting payslip figures, showing changes over time, preparing payroll questions, and keeping your tax-year review progress. We may also use limited account and service information to provide support, prevent misuse, and meet applicable legal obligations.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Service providers and document processing</h2>
          <p>We use the following providers to deliver the service. They receive only the information needed for their part of the product:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong className="text-foreground">Supabase</strong> provides authentication, the database, private document storage, and server functions. It holds your account, uploaded documents, extracted figures, and saved product data.</li>
            <li><strong className="text-foreground">OpenAI API</strong> provides the AI-assisted first transcription of an uploaded payslip. The document is sent directly from our server function to OpenAI; the result remains unconfirmed until you review it. OpenAI states that API inputs and outputs are not used to train its models by default. Under its default API data controls, content may be retained for up to 30 days for abuse monitoring unless different controls are approved and active for the production project.</li>
            <li><strong className="text-foreground">Stripe</strong> processes checkout, subscriptions, refunds, and billing administration when paid plans are enabled. Stripe receives purchase and billing information, not your payslip documents through our application.</li>
            <li><strong className="text-foreground">Plausible</strong> may measure visits to selected public pages only if it is configured and you accept optional analytics. Our integration excludes private app routes, query strings, fragments, account identifiers, and payslip contents.</li>
            <li><strong className="text-foreground">Lovable</strong> hosts and delivers the current web application. It can receive ordinary web-request information needed to serve the site; our application sends payslip files directly to private Supabase storage rather than to the web host.</li>
          </ul>
          <p>We do not sell payslip data. We will update this list if the production provider boundary changes.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Access and security</h2>
          <p>The service uses authenticated accounts and technical controls intended to limit access to customer data. No internet service can guarantee complete security. For that reason, you should review your extracted figures before relying on them and avoid sharing your account credentials.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Retention and deletion</h2>
          <p>We keep your account, original payslips, extracted and confirmed figures, comparisons, and saved plans while your account is active because those records provide the history and comparison features you request. An upload that is not successfully attached to your account is placed into a protected cleanup flow after its short-lived upload credential expires.</p>
          <p>You can request account deletion from within the product. The deletion flow stops new document access, removes live payslip files and product data, and then removes authentication access. A paid account can require a limited billing reconciliation step before deletion finishes so that a payment, cancellation, or refund is not lost. Provider backups, fraud-prevention records, transaction records, and information we must keep for a legal obligation can follow different timeframes, so we do not promise that every copy disappears at the same moment.</p>
          <p>Keep your own copies of payslips for your records; Payslip Insights is not your employer or your official payroll record. Contact us if a deletion request does not complete or you want confirmation of its status.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Your choices and rights</h2>
          <p>You can review and correct figures before you confirm them in the product. Depending on where you live, data-protection law may also give you rights to request access, correction, deletion, restriction, objection, or portability. Contact us if you want to make such a request; we may need to verify your identity first.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Browser storage, cookies, and similar technology</h2>
          <p>We use essential browser storage, including local storage, to keep you signed in and remember essential product preferences. We do not offer a switch to disable storage that is necessary for authentication or a choice you ask the product to remember.</p>
          <p>Optional analytics use Plausible and load only after you choose “Accept optional.” Our integration measures allowlisted public page views and a small set of product-discovery events. It does not deliberately send payslip contents, account identifiers, private app routes, URL query strings, or URL fragments. Choosing “Essential only” leaves Plausible unloaded; you can change the choice through the cookie settings shown by the site.</p>
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
