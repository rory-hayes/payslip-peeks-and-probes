import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const ItalyPayslipGuide = () => (
  <GuideLayout
    title="Italy Payslip Guide"
    description="IRPEF, INPS, addizionali and TFR explained in plain English for Italy-based employees, with the issues most often worth checking."
    breadcrumbLabel="Italy Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Italy Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A plain-English walkthrough of an Italian busta paga — the deductions you'll see each month and the issues Italy-based employees most often need to check.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">What appears on an Italian payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Retribuzione lorda</strong> — gross pay (paga base + scatti di anzianità + indennità).</li>
      <li><strong className="text-foreground">Contributi INPS</strong> — your social security contribution (around 9.19% of gross for most employees).</li>
      <li><strong className="text-foreground">IRPEF</strong> — income tax. Since 2024 there are 3 brackets: 23%, 35%, 43%.</li>
      <li><strong className="text-foreground">Addizionale regionale + comunale</strong> — small extra income tax to your region and city, usually around 1.5–2.5% combined.</li>
      <li><strong className="text-foreground">Detrazione lavoro dipendente</strong> — tax credit reducing your IRPEF.</li>
      <li><strong className="text-foreground">TFR</strong> — Trattamento di Fine Rapporto, accrued each month and paid out when you leave.</li>
      <li><strong className="text-foreground">Netto a pagare</strong> — what actually lands in your bank account.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common Italy payslip issues</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      The most common issues are detrazioni for family members (coniuge, figli a carico) not applied, addizionali based on the wrong comune, and TFR not being correctly accrued or destined to a fondo pensione if you opted in.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">IRPEF, INPS and addizionali overview</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      INPS is calculated as a percentage of your gross. IRPEF is calculated on the imponibile fiscale (gross minus INPS), then reduced by detrazioni. Addizionali regionali and comunali are added on top, depending on where you're resident on 1 January each year.
    </p>

    <RelatedGuides
      heading="Related Italy issue guides"
      items={[
        { title: 'Detrazioni per Familiari a Carico Mancanti', comingSoon: true },
        { title: 'Why Did My Netto a Pagare Change?', comingSoon: true },
        { title: 'TFR: In Azienda vs Fondo Pensione', comingSoon: true },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default ItalyPayslipGuide;
