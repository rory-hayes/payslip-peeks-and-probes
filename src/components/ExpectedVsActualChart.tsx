import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfile, useCurrency } from '@/hooks/use-profile';
import { calculateExpectedMonthly } from '@/lib/tax-calculator';
import type { Payslip } from '@/lib/types';
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

  if (!profile?.annual_salary || payslips.length < 2) return null;

  const opts = {
    pensionPercent: profile.has_pension ? (profile.pension_percent ?? 5) : 0,
    hasStudentLoan: profile.has_student_loan,
    studentLoanPlan: (profile.student_loan_plan as any) ?? 'plan2',
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

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Expected vs Actual — Over Time</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
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
        <div className="h-72">
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
      </CardContent>
    </Card>
  );
};

export default ExpectedVsActualChart;
