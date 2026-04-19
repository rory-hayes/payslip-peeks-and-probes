import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const NetherlandsPayslipGuide = () => (
  <GuideLayout
    title="Netherlands Payslip Guide"
    description="Loonheffing, heffingskorting and vakantiegeld explained in plain English for Netherlands-based employees, with the issues most often worth checking."
    datePublished="2025-03-01"
    breadcrumbLabel="Netherlands Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Netherlands Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A plain-English walkthrough of a Dutch loonstrook — the deductions you'll see each month and the issues Netherlands-based employees most often need to check.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">What appears on a Dutch payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Brutoloon</strong> — gross pay before deductions.</li>
      <li><strong className="text-foreground">Loonheffing</strong> — combined wage tax + premies volksverzekeringen (AOW, ANW, WLZ). The single biggest deduction on most Dutch payslips.</li>
      <li><strong className="text-foreground">Heffingskorting</strong> — tax credits (algemene heffingskorting + arbeidskorting) reducing your loonheffing.</li>
      <li><strong className="text-foreground">Pensioenpremie</strong> — your pension contribution, if you're in a pensioenregeling.</li>
      <li><strong className="text-foreground">Vakantiegeld</strong> — 8% holiday allowance, usually paid out in May.</li>
      <li><strong className="text-foreground">Nettoloon</strong> — what actually lands in your bank account.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common Netherlands payslip issues</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      The most common issues are loonheffingskorting being applied at two jobs at once (so you under-pay tax and owe money in your aangifte), 30%-ruling not being applied for eligible expats, and vakantiegeld being missed or under-paid in May.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Loonheffing and heffingskorting overview</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Loonheffing bundles together wage tax and your share of national insurance (volksverzekeringen) — that's why Dutch payslips usually only show one big tax line. The heffingskorting reduces this. If you have one main job, apply the loonheffingskorting there only — applying it at two jobs leads to a tax bill at the end of the year.
    </p>

    <RelatedGuides
      heading="Related Netherlands issue guides"
      items={[
        { title: 'Loonheffingskorting Applied at Two Jobs', comingSoon: true },
        { title: 'Why Is My Vakantiegeld Lower This Year?', comingSoon: true },
        { title: '30%-Ruling Missing on Your Loonstrook', comingSoon: true },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default NetherlandsPayslipGuide;
