import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const PortugalPayslipGuide = () => (
  <GuideLayout
    title="Portugal Payslip Guide"
    description="IRS, Segurança Social and subsídios explained in plain English for Portugal-based employees, with the issues most often worth checking."
    breadcrumbLabel="Portugal Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Portugal Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A plain-English walkthrough of a Portuguese recibo de vencimento — the deductions you'll see each month and the issues Portugal-based employees most often need to check.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">What appears on a Portuguese payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Vencimento bruto</strong> — gross pay before deductions.</li>
      <li><strong className="text-foreground">Retenção na fonte (IRS)</strong> — income tax withheld at source, using a tabela de retenção based on your salary and family situation.</li>
      <li><strong className="text-foreground">Segurança Social (TSU)</strong> — flat 11% of gross for most employees.</li>
      <li><strong className="text-foreground">Subsídio de férias / Natal</strong> — holiday and Christmas pay, paid in June and November (or duodécimos / monthly).</li>
      <li><strong className="text-foreground">Líquido a receber</strong> — what actually lands in your bank account.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common Portugal payslip issues</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      The most common issues are the wrong tabela de retenção being used (especially after a marriage, divorce or new dependant), subsídios being paid in duodécimos when you didn't ask for it, and IRS Jovem rates not being applied for eligible young workers.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">IRS and Segurança Social overview</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Segurança Social (TSU) is a flat 11% of gross. IRS retenção na fonte uses one of several tabelas published by the Autoridade Tributária — your tabela depends on whether you're single or married, with or without dependants, and whether you're on the IRS Jovem regime. Final IRS is settled in your declaração anual.
    </p>

    <RelatedGuides
      heading="Related Portugal issue guides"
      items={[
        { title: 'Wrong Tabela de Retenção on Your Recibo', comingSoon: true },
        { title: 'Subsídios em Duodécimos vs Pagos Aparte', comingSoon: true },
        { title: 'IRS Jovem Not Being Applied to Your Salary', comingSoon: true },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default PortugalPayslipGuide;
