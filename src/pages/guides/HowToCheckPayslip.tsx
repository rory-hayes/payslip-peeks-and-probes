import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

const HowToCheckPayslip = () => (
  <GuideLayout
    title="How to Check Your Payslip"
    description="A plain-English walk-through of every line on your payslip, what to compare each month, and the red flags worth checking with payroll."
    breadcrumbLabel="How to Check Your Payslip"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">How to Check Your Payslip</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      Most people glance at the net pay figure and move on. A two-minute check each month can catch tax, pension and deduction errors that quietly cost you hundreds of pounds or euros a year.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">Why checking your payslip matters</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Payroll systems make mistakes. Tax codes get applied late, pension contributions change without warning, and one-off deductions can appear without explanation. You are the only person who notices when something is off — and the sooner you spot it, the easier it is to fix.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">The main parts of a payslip</h2>
    <ul className="mt-3 space-y-2 text-muted-foreground">
      <li><strong className="text-foreground">Gross pay</strong> — your total earnings before any deductions.</li>
      <li><strong className="text-foreground">Net pay</strong> — what actually lands in your bank account.</li>
      <li><strong className="text-foreground">Tax</strong> — income tax (PAYE in both UK and Ireland).</li>
      <li><strong className="text-foreground">NI / PRSI / USC</strong> — social insurance and (in Ireland) the Universal Social Charge.</li>
      <li><strong className="text-foreground">Pension</strong> — employee contributions, often a percentage of gross.</li>
      <li><strong className="text-foreground">Other deductions</strong> — student loan, salary sacrifice, season ticket loans, union fees.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">What to compare every month</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      The single most useful habit is comparing this month with last month, line by line. Look for:
    </p>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li>Gross pay — same as last month, unless you had overtime, a bonus, or unpaid leave?</li>
      <li>Tax — moved in line with gross, or jumped unexpectedly?</li>
      <li>Pension — same percentage and same employer match as before?</li>
      <li>Deductions — anything new or different from last month?</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">Common red flags</h2>
    <Card className="mt-4 border-l-4 border-l-anomaly">
      <CardContent className="flex gap-3 p-5">
        <AlertTriangle className="h-5 w-5 shrink-0 text-anomaly" aria-hidden="true" />
        <div className="text-sm text-muted-foreground">
          <p>Watch for: same gross pay but lower take-home, a tax code that suddenly changes, missing pension contributions, or a brand-new deduction line you don't recognise.</p>
        </div>
      </CardContent>
    </Card>

    <h2 className="mt-10 text-2xl font-bold text-foreground">When to contact payroll</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      If a number doesn't match what you expect and you can't explain the difference from last month, it's worth raising. Be specific: cite the period, the line item, and the amount you'd expect. Payroll teams resolve clear, well-evidenced queries far faster than vague ones.
    </p>

    <GuideCTA />
  </GuideLayout>
);

export default HowToCheckPayslip;
