import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrency } from '@/hooks/use-profile';
import type { Payslip } from '@/lib/types';
import { summariseYearToDate } from '@/lib/year-to-date';
import { TrendingUp } from 'lucide-react';

interface Props {
  payslips: Payslip[];
}

const YearToDateSummary = ({ payslips }: Props) => {
  const { format: fmt } = useCurrency();
  const currentYear = new Date().getFullYear();

  const { payslips: ytdSlips, rows } = summariseYearToDate(payslips, currentYear);

  if (ytdSlips.length === 0) return null;

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
