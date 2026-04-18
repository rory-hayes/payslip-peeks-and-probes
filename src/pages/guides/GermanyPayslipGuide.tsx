import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const GermanyPayslipGuide = () => (
  <GuideLayout
    title="Germany Payslip Guide"
    description="Lohnsteuer, Sozialversicherung and Solidaritätszuschlag explained in plain English for Germany-based employees, with the issues most often worth checking."
    breadcrumbLabel="Germany Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Germany Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A plain-English walkthrough of a German Lohnabrechnung — the deductions you'll see each month and the issues Germany-based employees most often need to check.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">What appears on a German payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Steuerklasse</strong> — your tax class (I to VI). Drives how much Lohnsteuer is deducted.</li>
      <li><strong className="text-foreground">Brutto / Netto</strong> — gross pay and net (Auszahlungsbetrag).</li>
      <li><strong className="text-foreground">Lohnsteuer</strong> — income tax deducted at source.</li>
      <li><strong className="text-foreground">Solidaritätszuschlag (Soli)</strong> — 5.5% surcharge on Lohnsteuer above the exemption.</li>
      <li><strong className="text-foreground">Kirchensteuer</strong> — church tax (8% or 9%) if you're registered with a church.</li>
      <li><strong className="text-foreground">Sozialversicherung</strong> — KV (Krankenversicherung), RV (Rentenversicherung), AV (Arbeitslosenversicherung), PV (Pflegeversicherung). Roughly 20% of gross, capped.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common Germany payslip issues</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      The most common issues are wrong Steuerklasse after marriage or divorce, missing Kinderfreibetrag, KV contributions changing because you crossed the Beitragsbemessungsgrenze, and the Pflegeversicherung surcharge for childless employees over 23 not being applied correctly.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Lohnsteuer, Soli and Sozialversicherung overview</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Lohnsteuer is income tax withheld by your employer based on your Steuerklasse and ELStAM data. Soli is a 5.5% surcharge on Lohnsteuer (and only kicks in once your tax exceeds the exemption — most middle earners now pay none). Sozialversicherung is split roughly half-and-half between you and your employer, and is capped at the Beitragsbemessungsgrenzen.
    </p>

    <RelatedGuides
      heading="Related Germany issue guides"
      items={[
        { title: 'Wrong Steuerklasse on Your Payslip', comingSoon: true },
        { title: 'Why Did My Krankenversicherung Change?', comingSoon: true },
        { title: 'Why Did My Sozialversicherung Drop?', comingSoon: true },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default GermanyPayslipGuide;
