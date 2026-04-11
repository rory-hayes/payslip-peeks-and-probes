import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/AppLayout';
import DemoBanner from '@/components/DemoBanner';
import { usePayslips } from '@/hooks/use-payslip-data';
import { useCurrency } from '@/hooks/use-profile';
import { useDemoMode } from '@/contexts/DemoContext';
import { formatDate } from '@/lib/date-utils';
import { demoPayslips } from '@/lib/demo-data';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';

const ComparePayslips = () => {
  const [searchParams] = useSearchParams();
  const { data: realPayslips, isLoading: realLoading } = usePayslips();
  const { format: formatCurrency } = useCurrency();
  const { isDemoMode } = useDemoMode();

  const hasRealData = !realLoading && realPayslips && realPayslips.length > 0;
  const showDemo = isDemoMode && !hasRealData;
  const payslips = showDemo ? demoPayslips : (realPayslips || []);
  const isLoading = showDemo ? false : realLoading;

  const currentId = searchParams.get('current');
  const previousId = searchParams.get('previous');

  const current = payslips.find((s) => s.id === currentId) || (payslips.length > 0 ? payslips[payslips.length - 1] : null);
  const previous = payslips.find((s) => s.id === previousId) || (payslips.length > 1 ? payslips[payslips.length - 2] : null);

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

  if (!current || !previous) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-lg font-semibold text-foreground">Need at least 2 payslips to compare</h2>
          <p className="mt-2 text-sm text-muted-foreground">Upload more payslips to unlock comparison.</p>
          <Link to="/vault"><Button variant="outline" className="mt-4 gap-2"><ArrowLeft className="h-4 w-4" /> Back to vault</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const diffs = [
    { label: 'Gross pay', curr: current.gross_pay, prev: previous.gross_pay },
    { label: 'Tax', curr: current.tax_amount, prev: previous.tax_amount },
    { label: 'National Insurance', curr: current.ni_amount || 0, prev: previous.ni_amount || 0 },
    { label: 'Pension', curr: current.pension_amount || 0, prev: previous.pension_amount || 0 },
    { label: 'Student loan', curr: current.student_loan_amount || 0, prev: previous.student_loan_amount || 0 },
    { label: 'Total deductions', curr: current.total_deductions, prev: previous.total_deductions },
    { label: 'Net pay', curr: current.net_pay, prev: previous.net_pay },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {showDemo && <DemoBanner />}

        <div className="flex items-center gap-4">
          <Link to="/vault"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Compare payslips</h1>
            <p className="text-sm text-muted-foreground">{formatDate(previous.pay_date)} → {formatDate(current.pay_date)}</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-4 gap-0 text-sm">
              <div className="border-b border-border bg-muted/50 p-4 font-medium text-muted-foreground"></div>
              <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-muted-foreground">{formatDate(previous.pay_date).split(' ').slice(1).join(' ')}</div>
              <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-muted-foreground">{formatDate(current.pay_date).split(' ').slice(1).join(' ')}</div>
              <div className="border-b border-border bg-muted/50 p-4 text-center font-medium text-muted-foreground">Change</div>

              {diffs.map((row, i) => {
                const change = row.curr - row.prev;
                const isLast = row.label === 'Net pay';
                return (
                  <div key={i} className={`contents ${isLast ? 'font-semibold' : ''}`}>
                    <div className={`border-b border-border p-4 ${isLast ? 'bg-primary/5 font-bold text-foreground' : 'text-muted-foreground'}`}>{row.label}</div>
                    <div className={`border-b border-border p-4 text-center text-foreground ${isLast ? 'bg-primary/5' : ''}`}>{formatCurrency(row.prev)}</div>
                    <div className={`border-b border-border p-4 text-center text-foreground ${isLast ? 'bg-primary/5' : ''}`}>{formatCurrency(row.curr)}</div>
                    <div className={`border-b border-border p-4 text-center ${isLast ? 'bg-primary/5' : ''}`}>
                      {change === 0 ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="h-3 w-3" /> —</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 ${
                          (row.label === 'Net pay' || row.label === 'Gross pay')
                            ? (change > 0 ? 'text-success' : 'text-destructive')
                            : (change > 0 ? 'text-destructive' : 'text-success')
                        }`}>
                          {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {change > 0 ? '+' : ''}{formatCurrency(change)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What changed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            {current.net_pay !== previous.net_pay && (
              <p>Your net pay {current.net_pay > previous.net_pay ? 'increased' : 'decreased'} by <strong className="text-foreground">{formatCurrency(Math.abs(current.net_pay - previous.net_pay))}</strong>.</p>
            )}
            {current.student_loan_amount && !previous.student_loan_amount && (
              <p>A <strong className="text-foreground">student loan repayment</strong> of {formatCurrency(current.student_loan_amount)} appeared for the first time.</p>
            )}
            {current.ni_amount !== previous.ni_amount && (
              <p>National Insurance changed to <strong className="text-foreground">{formatCurrency(current.ni_amount || 0)}</strong> (was {formatCurrency(previous.ni_amount || 0)}).</p>
            )}
            <p className="text-xs">This comparison is for guidance only. Please verify with your payroll team if anything looks incorrect.</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          {!showDemo && (
            <Link to={`/draft/${current.id}`}>
              <Button className="gap-2">Draft payroll query <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default ComparePayslips;
