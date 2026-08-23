import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfile, useCurrency } from '@/hooks/use-profile';
import { calculateExpectedMonthly } from '@/lib/tax-calculator';
import type { DeductionOptions } from '@/lib/tax-calculator';
import type { Payslip } from '@/lib/types';
import { getTaxEstimateAvailability } from '@/lib/tax-estimate-availability';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

interface Props {
  payslips: Payslip[];
}

const ExpectedVsActualChart = ({ payslips }: Props) => {
  const { data: profile } = useProfile();
  const { format: fmt, symbol: currSym } = useCurrency();
  const titleId = useId();
  const summaryId = useId();

  if (!profile?.annual_salary || payslips.length < 2) return null;

  const hasVerifiedTaxTableForEverySlip = payslips.every((payslip) =>
    getTaxEstimateAvailability(profile.country, payslip.pay_date).available,
  );
  if (!hasVerifiedTaxTableForEverySlip) return null;

  const studentLoanPlan = profile.student_loan_plan;
  const opts: DeductionOptions = {
    pensionPercent: profile.has_pension ? (profile.pension_percent ?? 5) : 0,
    hasStudentLoan: profile.has_student_loan,
    studentLoanPlan: studentLoanPlan === 'plan1' || studentLoanPlan === 'plan2' || studentLoanPlan === 'plan4' || studentLoanPlan === 'plan5' || studentLoanPlan === 'postgrad' ? studentLoanPlan : 'plan2',
    subRegion: profile.sub_region,
    filingStatus: profile.filing_status,
  };
  const expected = calculateExpectedMonthly(profile.annual_salary, profile.country, opts);

  const chartData = payslips.slice(-12).map((slip) => {
    const month = new Date(slip.pay_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    return {
      month,
      actualNet: slip.net_pay,
      expectedNet: expected.netPay,
      actualTax: slip.tax_amount,
      expectedTax: expected.incomeTax,
      diff: slip.net_pay - expected.netPay,
    };
  });

  const latest = chartData.at(-1);
  const chartSummary = latest
    ? `Latest confirmed pay for ${latest.month}: actual net pay ${fmt(latest.actualNet)}, compared with estimated net pay ${fmt(latest.expectedNet)}.`
    : 'Confirmed pay compared with the estimate from your saved pay settings.';

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base" id={titleId}>Expected vs Actual — Over Time</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="How this over-time estimate is calculated"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Info aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                <p className="text-xs">
                  Compares your actual net pay each month against the estimated net based on your
                  {' '}{fmt(profile.annual_salary)} salary and {profile.country ?? 'UK'} tax rates.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <figure aria-describedby={summaryId} aria-labelledby={titleId}>
          <figcaption className="sr-only" id={summaryId}>{chartSummary}</figcaption>
          <div aria-hidden="true" className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${currSym}${v}`} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(val: number, name: string) => [fmt(val), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={expected.netPay} stroke="hsl(var(--primary))" strokeDasharray="6 3" label="" />
                <Bar dataKey="expectedNet" name="Expected net" fill="hsl(var(--primary) / 0.25)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actualNet" name="Actual net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Expected and actual net pay by confirmed payslip</caption>
            <thead>
              <tr>
                <th scope="col">Pay period</th>
                <th scope="col">Estimated net pay</th>
                <th scope="col">Actual net pay</th>
                <th scope="col">Difference</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, index) => (
                <tr key={`${row.month}-${index}`}>
                  <th scope="row">{row.month}</th>
                  <td>{fmt(row.expectedNet)}</td>
                  <td>{fmt(row.actualNet)}</td>
                  <td>{fmt(row.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      </CardContent>
    </Card>
  );
};

export default ExpectedVsActualChart;
