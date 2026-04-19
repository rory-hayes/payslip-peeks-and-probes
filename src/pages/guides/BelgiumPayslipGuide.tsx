import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const BelgiumPayslipGuide = () => (
  <GuideLayout
    title="Belgium Payslip Guide"
    description="Précompte professionnel, ONSS / RSZ and pécule de vacances explained in plain English for Belgium-based employees, with the issues most often worth checking."
    datePublished="2025-03-22"
    breadcrumbLabel="Belgium Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Belgium Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A plain-English walkthrough of a Belgian fiche de paie / loonfiche — the deductions you'll see each month and the issues Belgium-based employees most often need to check.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">What appears on a Belgian payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Salaire brut / Brutto loon</strong> — gross pay before deductions.</li>
      <li><strong className="text-foreground">ONSS / RSZ</strong> — social security contribution: 13.07% of gross, no cap.</li>
      <li><strong className="text-foreground">Précompte professionnel / Bedrijfsvoorheffing</strong> — wage tax withheld at source. Calculated on a barème, with adjustments for family situation and dependants.</li>
      <li><strong className="text-foreground">Pécule de vacances / Vakantiegeld</strong> — holiday pay (single + double), the double usually paid in May or June.</li>
      <li><strong className="text-foreground">Salaire net / Netto loon</strong> — what actually lands in your bank account.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common Belgium payslip issues</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      The most common issues are wrong family situation on the fiche fiscale 281.10 (so the précompte uses the wrong barème), missing chèques-repas or éco-chèques, and pécule de vacances not being correctly calculated when you change job mid-year.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Précompte professionnel and ONSS overview</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      ONSS / RSZ is a flat 13.07% on your gross. Précompte professionnel is wage tax — calculated using monthly barèmes published by the SPF Finances, adjusted for your family situation. The annual reckoning happens in your déclaration / aangifte, where you can recover any overpayment.
    </p>

    <RelatedGuides
      heading="Related Belgium issue guides"
      items={[
        { title: 'Wrong Barème de Précompte on Your Fiche', comingSoon: true },
        { title: 'Why Did My Pécule de Vacances Change?', comingSoon: true },
        { title: 'Chèques-repas Missing on Your Payslip', comingSoon: true },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default BelgiumPayslipGuide;
