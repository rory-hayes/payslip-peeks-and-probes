import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BrandLockup } from '@/components/BrandLockup';
import { applySeo } from '@/lib/seo';
import { marketingSeoFor } from '@/lib/marketing-seo-data';
import { publicLegalDetails } from '@/lib/public-legal-details';

const Terms = () => {
  useEffect(() => {
    applySeo(marketingSeoFor('/terms'));
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
      <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: August 2026</p>

      <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. About Payslip Insights</h2>
          <p>Payslip Insights is a payslip review, comparison, record-keeping, and payroll-question tool for employees in the United Kingdom and Ireland. It can help you notice changes or figures worth checking and guide you to official tax-year processes. <strong className="text-foreground">It does not calculate your final tax position and is not formal tax, legal, financial, or payroll advice.</strong> Always confirm a question with your employer, payroll team, the relevant tax authority, or a qualified professional.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. Your account</h2>
          <p>You must provide accurate account information, keep your credentials private, and be at least 18 years old to use the service. You are responsible for activity that takes place through your account.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Acceptable use</h2>
          <p>Only upload payslips that belong to you or that you have clear authority to use. Do not use the service to process another person&apos;s financial information without their permission. Do not attempt to scrape, reverse engineer, interfere with, or abuse the service.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Review the results</h2>
          <p>The service uses automated document extraction and comparison. Figures can be incomplete or incorrect, and an item marked as worth checking is not proof of an error. You must review the extracted figures and make your own decision about whether to contact payroll.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Plans and billing</h2>
          <p>If we offer a paid plan, the current price, billing interval, cancellation terms, and any applicable taxes will be shown at checkout before you are charged. We may change future pricing or features, but any material change to an active paid plan will be communicated through the service or by email where required.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Your records and account deletion</h2>
          <p>Payslip Insights is not your employer or your official payroll record. Keep your own copies of payslips and any information you need for tax, employment, or personal-record purposes. You can request account deletion through the product; the applicable retention and deletion process is described in the <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Privacy</h2>
          <p>Our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> explains the types of information the service handles, why it is used, and how you can make a privacy request. By using the service, you acknowledge that payslip documents may be processed by the service providers described there.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Service availability</h2>
          <p>We may change, suspend, or discontinue features to maintain, improve, or protect the service. We do not guarantee uninterrupted availability or that every payslip format will be recognised.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Liability</h2>
          <p>To the extent permitted by applicable law, Payslip Insights is provided without a guarantee that its extraction, comparisons, or suggestions are complete or correct. You remain responsible for your payroll, tax, and financial decisions. Nothing in these terms limits rights that cannot legally be limited.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">10. Changes to these terms</h2>
          <p>We may update these terms as the service changes. If a change materially affects an active paid subscription or a legal right, we will provide notice where required. Continuing to use the service after an updated effective date means you accept the revised terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">11. Legal information</h2>
          {publicLegalDetails.configured ? (
            <p>Payslip Insights is operated by <strong className="text-foreground">{publicLegalDetails.operatorName}</strong>, at {publicLegalDetails.operatorAddress}. These terms are governed by {publicLegalDetails.governingLaw}. Nothing in these terms removes mandatory consumer protections or rights that apply where you live.</p>
          ) : (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950" data-release-blocker="legal-operator">This is a pre-release build. The operator, address, and governing-law details are not configured, so it must not be offered as a public paid service.</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">12. Contact</h2>
          <p>Questions about these terms? Contact us at <a href="mailto:support@payslipinsights.com" className="text-primary hover:underline">support@payslipinsights.com</a>.</p>
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

export default Terms;
