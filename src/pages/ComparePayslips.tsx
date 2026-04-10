import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/layout/AppLayout';
import { demoPayslips, formatCurrency, formatDate } from '@/lib/demo-data';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';

const ComparePayslips = () => {
  const current = demoPayslips[demoPayslips.length - 1];
  const previous = demoPayslips[demoPayslips.length - 2];

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
        <div className="flex items-center gap-4">
          <Link to="/vault"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Compare payslips</h1>
            <p className="text-sm text-muted-foreground">{formatDate(previous.pay_date)} → {formatDate(current.pay_date)}</p>
          </div>
        </div>

        {/* Comparison table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-4 gap-0 text-sm">
              {/* Header */}
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

        {/* Summary */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What changed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>Your net pay decreased by <strong className="text-foreground">{formatCurrency(Math.abs(current.net_pay - previous.net_pay))}</strong> from {formatDate(previous.pay_date).split(' ').slice(1).join(' ')} to {formatDate(current.pay_date).split(' ').slice(1).join(' ')}.</p>
            {current.student_loan_amount && !previous.student_loan_amount && (
              <p>A <strong className="text-foreground">student loan repayment</strong> of {formatCurrency(current.student_loan_amount)} appeared for the first time. This is a new deduction that wasn't on your previous payslip.</p>
            )}
            {current.ni_amount !== previous.ni_amount && (
              <p>National Insurance returned to <strong className="text-foreground">{formatCurrency(current.ni_amount || 0)}</strong> (was {formatCurrency(previous.ni_amount || 0)} last month).</p>
            )}
            <p className="text-xs">This comparison is for guidance only. Please verify with your payroll team if anything looks incorrect.</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link to={`/draft/${current.id}`}>
            <Button className="gap-2">Draft payroll query <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};

export default ComparePayslips;
