import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';

const ComparePayslipsGuide = () => (
  <GuideLayout
    title="How to Compare Two Payslips Properly"
    description="A line-by-line approach to comparing this month's payslip with last month, and how Payslip Insights makes it automatic."
    breadcrumbLabel="How to Compare Two Payslips"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">How to Compare Two Payslips Properly</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A single payslip in isolation is hard to interpret. Comparing two consecutive payslips is where issues actually become visible.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">Why one payslip in isolation is hard to interpret</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Tax, pension and NI percentages all look reasonable on their own. It's only when you compare two months side by side that you can see whether anything has shifted, and by how much.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">What to compare line by line</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Gross pay</strong> — same base salary, plus any overtime, bonus or commission.</li>
      <li><strong className="text-foreground">Tax</strong> — should move proportionally with gross pay.</li>
      <li><strong className="text-foreground">NI / PRSI / USC</strong> — band thresholds matter, but month-to-month should be steady.</li>
      <li><strong className="text-foreground">Pension</strong> — the percentage should be identical unless you opted to change it.</li>
      <li><strong className="text-foreground">Other deductions</strong> — anything new, anything missing?</li>
      <li><strong className="text-foreground">Net pay</strong> — the bottom line, and the easiest to spot-check.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Changes that are easy to miss</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Tax code changes, year-to-date resets, benefits-in-kind appearing for the first time, and small percentage shifts in pension are all easy to miss with a quick scan. They add up over a year.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">How Payslip Insights helps</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Upload two payslips and we do the comparison automatically — flagging the lines that have moved meaningfully, with plain-English explanations of what's likely behind each change. No spreadsheets, no guesswork.
    </p>

    <GuideCTA />
  </GuideLayout>
);

export default ComparePayslipsGuide;
