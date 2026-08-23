import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';
import { Card, CardContent } from '@/components/ui/card';

const issues = [
  { title: 'Tax higher than expected', what: 'Compare your tax code to last month. An emergency code such as 1257L W1, 1257L M1, or 1257L X may be used when payroll does not yet have the details it needs. Check the code with HMRC or payroll.' },
  { title: 'Pension contribution missing or reduced', what: 'Check the pension line against your contract percentage. New starters and salary changes often miss a cycle.' },
  { title: 'New unexplained deduction', what: 'Look for unfamiliar line items. Season ticket loans, charity giving and union fees often start without explicit notice.' },
  { title: 'Same gross pay but lower take-home', what: 'Run a tax / NI / pension comparison with last month — one of them has moved.' },
  { title: 'Bonus taxed more than expected', what: 'Bonuses are often taxed at your marginal rate plus pushed through monthly tax tables, which can look brutal in the moment.' },
  { title: 'Hours or overtime missing', what: 'Reconcile against your timesheet — overtime is one of the most commonly omitted items.' },
  { title: 'Wrong tax code applied', what: 'Codes change after a job switch, benefits change, or HMRC / Revenue notification. Verify against your latest coding notice.' },
  { title: 'Holiday pay not included', what: 'If you took paid holiday, check it appears as paid hours rather than unpaid leave.' },
  { title: 'Salary sacrifice applied incorrectly', what: 'Salary sacrifice should reduce your gross before tax. If it shows as a post-tax deduction, the tax saving is lost.' },
  { title: 'Year-to-date totals not adding up', what: 'YTD figures should equal the sum of all payslips so far. A reset usually means a payroll system change worth questioning.' },
];

const CommonMistakes = () => (
  <GuideLayout
    title="Common Payslip Mistakes to Watch For"
    description="Common payslip issues to check across UK and Ireland employees, with practical next steps before contacting payroll."
    breadcrumbLabel="Common Payslip Mistakes"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Common Payslip Mistakes to Watch For</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      Here are common things to check on your own payslip before you decide whether to contact payroll.
    </p>

    <div className="mt-10 space-y-4">
      {issues.map((issue, i) => (
        <Card key={issue.title}>
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-foreground">
              <span className="text-primary mr-2">{i + 1}.</span>{issue.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed"><strong className="text-foreground">What to check:</strong> {issue.what}</p>
          </CardContent>
        </Card>
      ))}
    </div>

    <h2 className="mt-12 text-2xl font-bold text-foreground">Before contacting payroll</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Bring evidence. Have last month's payslip to hand, note the specific line item and amount, and explain what you expected to see and why. Clear, specific queries get resolved faster.
    </p>

    <GuideCTA />
  </GuideLayout>
);

export default CommonMistakes;
