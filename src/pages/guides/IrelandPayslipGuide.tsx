import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const IrelandPayslipGuide = () => (
  <GuideLayout
    title="Ireland Payslip Guide"
    description="PAYE, PRSI and USC explained in plain English for Ireland-based employees, with the issues most often worth checking."
    breadcrumbLabel="Ireland Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Ireland Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A plain-English walkthrough of Irish payslips, the deductions you'll see each month, and the issues Ireland-based employees most often need to check.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">What appears on an Ireland payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">PPS number</strong> and your tax credit / standard rate cut-off.</li>
      <li><strong className="text-foreground">Gross pay</strong>, <strong className="text-foreground">taxable pay</strong> and <strong className="text-foreground">net pay</strong>.</li>
      <li><strong className="text-foreground">PAYE</strong> — income tax deducted this period and year-to-date.</li>
      <li><strong className="text-foreground">PRSI</strong> — Pay Related Social Insurance, with class shown.</li>
      <li><strong className="text-foreground">USC</strong> — Universal Social Charge, banded by income.</li>
      <li><strong className="text-foreground">Pension contributions</strong>, plus any other deductions.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common Ireland payslip issues</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      The most common issues are PAYE applied incorrectly after a job change, PRSI class changes that affect contributions, and USC bands not updating after a pay rise. Pension contribution changes after auto-enrolment cycles also catch people off guard.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">PAYE, PRSI and USC overview</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      PAYE is income tax, applied through your tax credits and rate band. PRSI is social insurance, with different classes for different employment types. USC is a separate charge banded by income — most employees pay a small amount on their first chunk of earnings and a higher rate above the threshold.
    </p>

    <RelatedGuides
      heading="Related Ireland issue guides"
      items={[
        { title: 'Wrong PAYE on Your Payslip (Ireland)', comingSoon: true },
        { title: 'Why Did My PRSI Change?', comingSoon: true },
        { title: 'Why Did My USC Change?', comingSoon: true },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default IrelandPayslipGuide;
