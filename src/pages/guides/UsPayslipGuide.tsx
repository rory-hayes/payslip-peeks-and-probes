import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import RelatedGuides from '@/components/guides/RelatedGuides';

const UsPayslipGuide = () => (
  <GuideLayout
    title="US Payslip Guide"
    description="Federal Withholding, FICA (OASDI + Medicare), state tax and pre-tax 401(k)/HSA/FSA explained for US employees on ADP, Gusto and Paychex."
    breadcrumbLabel="US Payslip Guide"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">US Payslip Guide</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A plain-English walkthrough of a US pay stub — federal and state withholding, FICA, the most common pre-tax deductions, and how to find each line on ADP, Gusto and Paychex layouts.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">The four big deductions on every US paycheck</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Federal Withholding</strong> — federal income tax estimated from your W-4 (filing status, dependents, extra withholding).</li>
      <li><strong className="text-foreground">FICA — OASDI (Social Security)</strong> — 6.2% of wages up to the annual wage base ($168,600 in 2024).</li>
      <li><strong className="text-foreground">FICA — HI (Medicare)</strong> — 1.45% of all wages, plus an extra 0.9% on wages above $200,000 (single).</li>
      <li><strong className="text-foreground">State Withholding (SIT)</strong> — state income tax. Nine states (TX, FL, WA, NV, SD, WY, AK, TN, NH) have no state income tax on wages.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Federal Withholding (Fed W/H, FIT)</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Federal income tax isn't a flat rate — it's an estimate of what you'll owe at year end, spread across each paycheck. Your W-4 drives the calculation. If you got a big refund or owed a lot last April, your W-4 is probably out of date. Look for it labelled <em>Fed Withholding</em>, <em>FIT</em>, or <em>Fed Income Tax</em>.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">FICA — OASDI and HI</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      FICA is split into two lines:
    </p>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">OASDI / Social Security / SS Tax</strong> — 6.2% flat, but stops once your YTD wages cross the wage base. High earners see this line drop to $0 later in the year.</li>
      <li><strong className="text-foreground">HI / Medicare / FICA-Med</strong> — 1.45% on every dollar, no cap. The extra 0.9% Additional Medicare kicks in once YTD wages cross $200,000.</li>
    </ul>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Important: pre-tax 401(k), HSA and FSA contributions <strong className="text-foreground">do not</strong> reduce FICA wages. They only reduce income tax.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">State Withholding (SIT)</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      State tax varies enormously — California tops out at 13.3%, Pennsylvania is a flat 3.07%, Texas is zero. Some states also charge city/local tax (NYC, Philadelphia, San Francisco). Look for <em>SIT</em>, <em>State Tax</em>, or your state code (e.g. <em>CA Withholding</em>).
    </p>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      You may also see <strong className="text-foreground">SDI</strong> (state disability, e.g. CA, NY, NJ), <strong className="text-foreground">SUI</strong> (unemployment) and <strong className="text-foreground">PFL</strong> (paid family leave). These are usually small but real deductions.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Pre-tax deductions — 401(k), HSA, FSA</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Traditional 401(k)</strong> — reduces federal and (most) state taxable wages. Does not reduce FICA. Pennsylvania and New Jersey treat 401(k) as post-tax for state purposes.</li>
      <li><strong className="text-foreground">Roth 401(k)</strong> — taken after tax. Doesn't reduce taxable wages today but grows tax-free.</li>
      <li><strong className="text-foreground">HSA</strong> (Health Savings Account, paired with a high-deductible health plan) — reduces federal income tax, FICA, and most state tax. Triple tax advantage.</li>
      <li><strong className="text-foreground">FSA</strong> (Flexible Spending Account) — reduces federal income tax and FICA. Use-it-or-lose-it within the plan year.</li>
      <li><strong className="text-foreground">Health/dental/vision insurance premiums</strong> — usually pre-tax under a Section 125 cafeteria plan; reduces federal, state, and FICA.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">How to read an ADP payslip</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      ADP groups the stub into <strong className="text-foreground">Earnings</strong> (top), <strong className="text-foreground">Taxes</strong> (federal, FICA-OASDI, FICA-Medicare, state), <strong className="text-foreground">Deductions</strong> (401(k), medical, etc.), and a <strong className="text-foreground">Net Pay</strong> summary at the bottom. Each row shows <em>Current</em> and <em>YTD</em> columns. The "Gross" line at the top will not match your "Taxable Gross" if you have pre-tax deductions — that's expected.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">How to read a Gusto payslip</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Gusto puts a clear <strong className="text-foreground">Take Home Pay</strong> headline at the top, then breaks the calculation into <strong className="text-foreground">Earnings → Pre-tax deductions → Taxes → Post-tax deductions → Net pay</strong>. The "Tax" section labels each line clearly (Federal Income Tax, Social Security, Medicare, plus your state). It's the easiest of the three to read at a glance.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">How to read a Paychex payslip</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Paychex uses condensed labels: <em>Fed W/H</em> for federal, <em>FICA-SS</em> and <em>FICA-Med</em> for the two FICA lines, and the state two-letter code for state withholding (e.g. <em>NY W/H</em>). Pre-tax deductions appear under "Before-Tax Deductions" and Roth/post-tax under "After-Tax Deductions".
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">What to check each pay period</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li>Hours and rate match what you expected (especially for hourly or overtime).</li>
      <li>401(k) percentage actually came out, and matches your election.</li>
      <li>Filing status on Federal Withholding matches your current W-4.</li>
      <li>State code is correct — common issue after moving states or working remotely.</li>
      <li>YTD totals roughly track: gross × pay periods elapsed.</li>
    </ul>

    <RelatedGuides
      heading="Related guides"
      items={[
        { title: 'How to Check Your Payslip', to: '/guides/how-to-check-your-payslip' },
        { title: 'Why Did My Net Pay Go Down?', to: '/guides/why-did-my-net-pay-go-down' },
        { title: 'How to Compare Two Payslips', to: '/guides/compare-two-payslips' },
      ]}
    />

    <GuideCTA />
  </GuideLayout>
);

export default UsPayslipGuide;
