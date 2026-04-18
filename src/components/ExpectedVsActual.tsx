import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfile, useCurrency } from '@/hooks/use-profile';
import { calculateExpectedMonthly } from '@/lib/tax-calculator';
import { getCountryConfig } from '@/lib/countries';
import type { Payslip } from '@/lib/types';
import { ArrowDown, ArrowUp, Minus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  latestPayslip: Payslip;
}

const ExpectedVsActual = ({ latestPayslip }: Props) => {
  const { data: profile } = useProfile();
  const { format: fmt } = useCurrency();

  if (!profile?.annual_salary) return null;

  const opts = {
    pensionPercent: profile.has_pension ? (profile.pension_percent ?? 5) : 0,
    hasStudentLoan: profile.has_student_loan,
    studentLoanPlan: (profile.student_loan_plan as any) ?? 'plan2',
  };
  const expected = calculateExpectedMonthly(profile.annual_salary, profile.country, opts);
  const config = getCountryConfig(profile.country);

  // Build rows from the country's deductionLines, dropping zero-expected optional rows.
  const deductionRows = config.deductionLines
    .map((line) => {
      const expectedAmount = (expected[line.expectedKey] as number) ?? 0;
      const actualAmount = ((latestPayslip as any)[line.fieldKey] as number) ?? 0;
      return { label: line.label, expected: expectedAmount, actual: actualAmount, isOptional: line.fieldKey === 'pension_amount' || line.fieldKey === 'student_loan_amount' || line.fieldKey === 'church_tax_amount' };
    })
    .filter((row) => !row.isOptional || row.expected > 0 || row.actual > 0);

  const rows = [
    { label: 'Gross pay', expected: expected.grossMonthly, actual: latestPayslip.gross_pay },
    ...deductionRows,
    { label: 'Net pay', expected: expected.netPay, actual: latestPayslip.net_pay },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Expected vs Actual</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <div className="space-y-2 text-xs">
                  <p>
                    Estimate based on annual gross of <strong>{fmt(profile.annual_salary)}</strong> for {config.name}
                    {expected.pension > 0 ? `, ${profile.pension_percent ?? 5}% pension` : ''}
                    {expected.studentLoan > 0 ? `, ${(profile.student_loan_plan ?? 'plan2').replace('plan', 'Plan ')} student loan` : ''}.
                  </p>
                  <p className="text-muted-foreground border-t border-border pt-2">
                    <strong className="text-foreground">Assumptions:</strong> {config.taxAssumptionsBlurb}
                  </p>
                  <p className="text-muted-foreground italic">
                    Estimates only — your actual deductions may differ. Not formal tax advice.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b border-border">
          <span />
          <span className="text-right">Expected</span>
          <span className="text-right">Actual</span>
          <span className="text-right">Diff</span>
        </div>

        <div className="divide-y divide-border">
          {rows.map((row) => {
            const diff = row.actual - row.expected;
            const isLast = row.label === 'Net pay';
            const isDeduction = !isLast && row.label !== 'Gross pay';
            const isGood = isDeduction ? diff <= 0 : diff >= 0;
            const absDiff = Math.abs(diff);

            return (
              <div key={row.label} className={`grid grid-cols-4 gap-2 py-2.5 items-center ${isLast ? 'font-semibold' : ''}`}>
                <span className="text-sm text-foreground">{row.label}</span>
                <span className="text-sm text-muted-foreground text-right">{fmt(row.expected)}</span>
                <span className="text-sm text-foreground text-right">{fmt(row.actual)}</span>
                <span className={`text-sm text-right flex items-center justify-end gap-1 ${
                  absDiff < 1 ? 'text-muted-foreground' :
                  isGood ? 'text-success' : 'text-destructive'
                }`}>
                  {absDiff < 1 ? (
                    <><Minus className="h-3 w-3" /> —</>
                  ) : (
                    <>
                      {diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {fmt(absDiff)}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpectedVsActual;
