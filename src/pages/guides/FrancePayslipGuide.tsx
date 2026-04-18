import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const FrancePayslipGuide = () => (
  <GuideLayout
    title="France Payslip Guide"
    description="Prélèvement à la source, cotisations sociales and AGIRC-ARRCO explained in plain English for France-based employees, with the issues most often worth checking."
    breadcrumbLabel="France Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">France Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A plain-English walkthrough of a French bulletin de paie — the deductions you'll see each month and the issues France-based employees most often need to check.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">What appears on a French payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Salaire brut</strong> — gross salary before any deductions.</li>
      <li><strong className="text-foreground">Cotisations salariales</strong> — your share of social contributions: CSG, CRDS, Sécurité sociale, chômage, retraite (AGIRC-ARRCO for cadres).</li>
      <li><strong className="text-foreground">Net imposable</strong> — the figure income tax is calculated on.</li>
      <li><strong className="text-foreground">Prélèvement à la source (PAS)</strong> — income tax withheld at source by your employer.</li>
      <li><strong className="text-foreground">Net à payer</strong> — what actually lands in your bank account.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common France payslip issues</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      The most common issues are an out-of-date taux de prélèvement (especially after a marriage, divorce or pay change), AGIRC-ARRCO not applied for cadres, and missing tickets-restaurant or transport reimbursements.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">PAS, CSG and Sécurité sociale overview</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      PAS is your monthly income tax, deducted directly by your employer based on the rate set by impots.gouv.fr. CSG and CRDS are flat-rate contributions on most of your gross. Sécurité sociale, chômage and retraite are the rest of the cotisations salariales — usually around 22% of gross combined for a typical employee.
    </p>

    <RelatedGuides
      heading="Related France issue guides"
      items={[
        { title: 'Wrong Taux de Prélèvement on Your Bulletin', comingSoon: true },
        { title: 'Why Did My Net à Payer Change?', comingSoon: true },
        { title: 'AGIRC-ARRCO Not Applied to Your Salary', comingSoon: true },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default FrancePayslipGuide;
