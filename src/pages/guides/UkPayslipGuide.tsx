import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const UkPayslipGuide = () => (
  <GuideLayout
    title="UK Payslip Guide"
    description="Tax codes, National Insurance, pension and the parts of a UK payslip every employee should understand."
    datePublished="2025-02-01"
    breadcrumbLabel="UK Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">UK Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A clear walkthrough of UK payslips — what each section means, what to compare each month, and details that may be worth checking with payroll.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">What appears on a UK payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Tax code</strong> — a code such as 1257L may appear on a standard UK payslip; check it against your HMRC record if it changes unexpectedly.</li>
      <li><strong className="text-foreground">National Insurance number</strong> and <strong className="text-foreground">NI category letter</strong>.</li>
      <li><strong className="text-foreground">Gross pay</strong>, <strong className="text-foreground">taxable pay</strong> and <strong className="text-foreground">net pay</strong>.</li>
      <li><strong className="text-foreground">Income Tax (PAYE)</strong> deducted this period and year-to-date.</li>
      <li><strong className="text-foreground">Employee NI contributions</strong>.</li>
      <li><strong className="text-foreground">Pension contributions</strong> — yours and (often shown separately) your employer's.</li>
      <li>Optional: student loan, salary sacrifice, benefits in kind.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common UK payslip issues</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Things worth checking include a tax code that has changed unexpectedly, pension contributions that do not match your scheme information, or a change in tax after a bonus or job change.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Tax code, NI and pension overview</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Your tax code tells your employer how much tax-free pay you're entitled to each year. If it looks wrong, check your HMRC personal tax account. NI is calculated on earnings above a threshold and varies by category letter. Pension contributions are usually a fixed percentage of qualifying earnings.
    </p>

    <RelatedGuides
      heading="Related UK issue guides"
      items={[
        { title: 'Wrong Tax on Payslip (UK)', comingSoon: true },
        { title: 'Same Salary, Lower Take-Home Pay (UK)', comingSoon: true },
        { title: 'Emergency Tax on Your Payslip (UK)', comingSoon: true },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default UkPayslipGuide;
