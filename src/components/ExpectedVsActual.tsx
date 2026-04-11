import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfile, useCurrency } from '@/hooks/use-profile';
import { calculateExpectedMonthly } from '@/lib/tax-calculator';
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
    pensionPercent: profile.has_pension ? 5 : 0,
    hasStudentLoan: profile.has_student_loan,
  };
  const expected = calculateExpectedMonthly(profile.annual_salary, profile.country, opts);
  const actual = latestPayslip;

  const rows = [
    { label: 'Gross pay', expected: expected.grossMonthly, actual: actual.gross_pay },
    { label: 'Income tax', expected: expected.incomeTax, actual: actual.tax_amount },
    ...(profile.country === 'Ireland'
      ? [
          { label: 'PRSI', expected: expected.nationalInsurance, actual: actual.prsi_amount ?? 0 },
          { label: 'USC', expected: expected.usc, actual: actual.usc_amount ?? 0 },
        ]
      : [
          { label: 'National Insurance', expected: expected.nationalInsurance, actual: actual.ni_amount ?? 0 },
        ]),
    ...(expected.pension > 0
      ? [{ label: 'Pension', expected: expected.pension, actual: actual.pension_amount ?? 0 }]
      : []),
    ...(expected.studentLoan > 0
      ? [{ label: 'Student loan', expected: expected.studentLoan, actual: actual.student_loan_amount ?? 0 }]
      : []),
    { label: 'Net pay', expected: expected.netPay, actual: actual.net_pay },
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
              <TooltipContent className="max-w-64">
                <p className="text-xs">
                  Based on your annual salary of {fmt(profile.annual_salary)} and {profile.country ?? 'UK'} tax rates
                  {expected.pension > 0 ? ', 5% pension contribution' : ''}
                  {expected.studentLoan > 0 ? ', Plan 2 student loan' : ''}.
                  Estimates only — may differ from actual deductions.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {/* Table header */}
        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b border-border">
          <span />
          <span className="text-right">Expected</span>
          <span className="text-right">Actual</span>
          <span className="text-right">Diff</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {rows.map((row) => {
            const diff = row.actual - row.expected;
            const isLast = row.label === 'Net pay';
            const isDeduction = !isLast && row.label !== 'Gross pay';
            // For deductions, paying more than expected is bad (red). For net pay, receiving less is bad.
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
