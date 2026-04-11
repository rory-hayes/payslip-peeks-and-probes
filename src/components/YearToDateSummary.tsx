import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrency } from '@/hooks/use-profile';
import type { Payslip } from '@/lib/types';
import { TrendingUp } from 'lucide-react';

interface Props {
  payslips: Payslip[];
}

const YearToDateSummary = ({ payslips }: Props) => {
  const { format: fmt } = useCurrency();
  const currentYear = new Date().getFullYear();

  const ytdSlips = payslips.filter(
    (s) => new Date(s.pay_date).getFullYear() === currentYear,
  );

  if (ytdSlips.length === 0) return null;

  const totals = ytdSlips.reduce(
    (acc, s) => ({
      gross: acc.gross + s.gross_pay,
      net: acc.net + s.net_pay,
      tax: acc.tax + s.tax_amount,
      ni: acc.ni + (s.ni_amount ?? 0),
      pension: acc.pension + (s.pension_amount ?? 0),
      studentLoan: acc.studentLoan + (s.student_loan_amount ?? 0),
      deductions: acc.deductions + s.total_deductions,
    }),
    { gross: 0, net: 0, tax: 0, ni: 0, pension: 0, studentLoan: 0, deductions: 0 },
  );

  const rows = [
    { label: 'Gross pay', value: totals.gross },
    { label: 'Income tax', value: totals.tax },
    totals.ni > 0 && { label: 'National Insurance', value: totals.ni },
    totals.pension > 0 && { label: 'Pension', value: totals.pension },
    totals.studentLoan > 0 && { label: 'Student loan', value: totals.studentLoan },
    { label: 'Total deductions', value: totals.deductions },
    { label: 'Net pay', value: totals.net, bold: true },
  ].filter(Boolean) as { label: string; value: number; bold?: boolean }[];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{currentYear} Year-to-Date Summary</CardTitle>
          <span className="ml-auto text-xs text-muted-foreground">
            {ytdSlips.length} payslip{ytdSlips.length !== 1 ? 's' : ''}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between text-sm ${
                row.bold
                  ? 'border-t border-border pt-2 mt-1 font-semibold text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              <span>{row.label}</span>
              <span className={row.bold ? 'text-foreground' : ''}>{fmt(row.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default YearToDateSummary;
