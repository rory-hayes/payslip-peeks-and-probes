import { Link, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/AppLayout';
import { usePayslips } from '@/hooks/use-payslip-data';
import { formatDate } from '@/lib/date-utils';
import {
  comparisonRowsFor,
  deductionChangesFor,
  formatComparisonCurrency,
  selectPayslipComparison,
  type ComparisonRow,
  type ComparisonSelectionIssue,
} from '@/lib/payslip-comparison';
import type { Payslip } from '@/lib/types';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';

const unavailableCopy: Record<ComparisonSelectionIssue, { title: string; description: string }> = {
  needs_review: {
    title: 'Review a payslip before comparing',
    description: 'Only confirmed payslips can be compared. Review the selected payslip in your vault, then return here.',
  },
  not_found: {
    title: 'That comparison is unavailable',
    description: 'One of the selected payslips is no longer available. Choose two confirmed payslips from your vault.',
  },
  same_payslip: {
    title: 'Choose two different confirmed payslips',
    description: 'Select an earlier confirmed payslip to make a side-by-side comparison.',
  },
  country_mismatch: {
    title: 'Choose confirmed payslips from the same country',
    description: 'Country-specific payroll terms and currencies can differ, so this view does not compare them together.',
  },
  invalid_pay_date: {
    title: 'Review the pay date before comparing',
    description: 'A selected confirmed payslip does not have a usable pay date yet. Check it in your vault before comparing.',
  },
  invalid_order: {
    title: 'Choose an earlier payslip to compare',
    description: 'The previous payslip needs to be earlier than the current payslip.',
  },
  needs_confirmed_history: {
    title: 'Need two confirmed payslips to compare',
    description: 'Upload or review another payslip from the same country to unlock a side-by-side comparison.',
  },
};

function formatKnownAmount(value: number | null, country: Payslip['country']): string {
  return value === null ? 'Not listed' : formatComparisonCurrency(value, country);
}

function changeFor(row: ComparisonRow): number | null {
  return row.current === null || row.previous === null ? null : row.current - row.previous;
}

function ComparisonUnavailable({ issue }: { issue: ComparisonSelectionIssue }) {
  const copy = unavailableCopy[issue];

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-20 text-center" role="status">
        <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{copy.description}</p>
        <Button asChild variant="outline" className="mt-4 gap-2">
          <Link to="/vault"><ArrowLeft className="h-4 w-4" /> Back to vault</Link>
        </Button>
      </div>
    </AppLayout>
  );
}

const ComparePayslips = () => {
  const [searchParams] = useSearchParams();
  const { data: realPayslips, isLoading, isError, refetch } = usePayslips();

  const payslips = realPayslips || [];
  const { comparison, issue } = selectPayslipComparison(
    payslips,
    searchParams.get('current'),
    searchParams.get('previous'),
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-3xl">
          <Skeleton className="h-8 w-48" />
          <Card className="border-0 shadow-sm"><CardContent className="p-6 space-y-4">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center" role="alert">
          <h2 className="text-lg font-semibold text-foreground">We couldn’t load the payslips for this comparison.</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Your saved payslips have not been changed. Check your connection and try again before comparing them.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button className="min-h-11" onClick={() => void refetch()}>Try again</Button>
            <Button asChild variant="outline" className="min-h-11 gap-2">
              <Link to="/vault"><ArrowLeft className="h-4 w-4" /> Back to vault</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!comparison || issue) return <ComparisonUnavailable issue={issue ?? 'needs_confirmed_history'} />;

  const { current, previous } = comparison;
  const rows = comparisonRowsFor(current, previous);
  const changedDeductions = deductionChangesFor(current, previous).slice(0, 2);
  const netPayChange = current.net_pay - previous.net_pay;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="min-h-11 min-w-11">
            <Link to="/vault" aria-label="Back to saved payslips"><ArrowLeft aria-hidden="true" className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Compare payslips</h1>
            <p className="text-sm text-muted-foreground">{formatDate(previous.pay_date)} → {formatDate(current.pay_date)} · confirmed {current.country} payslips</p>
          </div>
        </div>

        <Card className="overflow-hidden border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="grid min-w-[40rem] grid-cols-4 gap-0 text-sm">
                <div className="border-b border-border bg-muted/50 p-4 font-medium text-muted-foreground"><span className="sr-only">Pay line</span></div>
                <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-muted-foreground">{formatDate(previous.pay_date).split(' ').slice(1).join(' ')}</div>
                <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-muted-foreground">{formatDate(current.pay_date).split(' ').slice(1).join(' ')}</div>
                <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-muted-foreground">Change</div>

                {rows.map((row) => {
                const change = changeFor(row);
                const isLast = row.isNetPay === true;
                return (
                  <div key={row.label} className={`contents ${isLast ? 'font-semibold' : ''}`}>
                    <div className={`border-b border-border p-4 ${isLast ? 'bg-primary/5 font-bold text-foreground' : 'text-muted-foreground'}`}>{row.label}</div>
                    <div className={`border-b border-border p-4 text-center text-foreground ${isLast ? 'bg-primary/5' : ''}`}>{formatKnownAmount(row.previous, current.country)}</div>
                    <div className={`border-b border-border p-4 text-center text-foreground ${isLast ? 'bg-primary/5' : ''}`}>{formatKnownAmount(row.current, current.country)}</div>
                    <div className={`border-b border-border p-4 text-center ${isLast ? 'bg-primary/5' : ''}`}>
                      {change === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : change === 0 ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="h-3 w-3" /> —</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 ${
                          row.kind === 'pay'
                            ? (change > 0 ? 'text-success' : 'text-destructive')
                            : (change > 0 ? 'text-destructive' : 'text-success')
                        }`}>
                          {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {change > 0 ? '+' : ''}{formatComparisonCurrency(change, current.country)}
                        </span>
                      )}
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What changed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            {netPayChange === 0 ? (
              <p>The confirmed net-pay figures match for these two payslips.</p>
            ) : (
              <p>Your net pay {netPayChange > 0 ? 'increased' : 'decreased'} by <strong className="text-foreground">{formatComparisonCurrency(Math.abs(netPayChange), current.country)}</strong>.</p>
            )}
            {changedDeductions.map((deduction) => (
              <p key={deduction.label}>{deduction.label} changed to <strong className="text-foreground">{formatComparisonCurrency(deduction.current, current.country)}</strong> (was {formatComparisonCurrency(deduction.previous, current.country)}).</p>
            ))}
            <p className="text-xs">This view puts confirmed figures side by side for review; it cannot tell you whether payroll is correct. Check the original payslips and ask your payroll team if something looks wrong.</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button asChild className="gap-2">
            <Link to={`/draft/${current.id}`}>Draft payroll query <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ComparePayslips;
