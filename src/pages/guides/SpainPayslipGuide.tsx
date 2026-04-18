import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const SpainPayslipGuide = () => (
  <GuideLayout
    title="Spain Payslip Guide"
    description="IRPF, Seguridad Social and bases de cotización explained in plain English for Spain-based employees, with the issues most often worth checking."
    breadcrumbLabel="Spain Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Spain Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A plain-English walkthrough of a Spanish nómina — the deductions you'll see each month and the issues Spain-based employees most often need to check.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">What appears on a Spanish payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Total devengado</strong> — gross pay (salario base + complementos + pagas extras prorrateadas).</li>
      <li><strong className="text-foreground">Retención IRPF</strong> — income tax withheld at source. The percentage depends on your situation (familia, hijos, ingresos).</li>
      <li><strong className="text-foreground">Seguridad Social</strong> — your share: contingencias comunes (4.7%) + desempleo (1.55%) + formación profesional (0.10%) + MEI (0.13%).</li>
      <li><strong className="text-foreground">Base de cotización</strong> — the figure used to calculate Seguridad Social, capped at the base máxima.</li>
      <li><strong className="text-foreground">Líquido a percibir</strong> — what actually lands in your bank account.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common Spain payslip issues</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      The most common issues are an out-of-date tipo de retención after a pay rise or family change, pagas extras (June and December) being prorrateadas without your agreement, and the Seguridad Social base máxima not being applied correctly.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">IRPF and Seguridad Social overview</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Your IRPF tipo is set by your employer using a calculator from the Agencia Tributaria, based on your salary and personal situation. Seguridad Social is around 6.48% of gross for a standard worker, capped at the base máxima of about €56,646/year. Together they typically take 25–35% of gross for a mid-band employee.
    </p>

    <RelatedGuides
      heading="Related Spain issue guides"
      items={[
        { title: 'Wrong Tipo de Retención on Your Nómina', comingSoon: true },
        { title: 'Pagas Extras: Prorrateadas vs Aparte', comingSoon: true },
        { title: 'Why Did My Líquido a Percibir Drop?', comingSoon: true },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default SpainPayslipGuide;
