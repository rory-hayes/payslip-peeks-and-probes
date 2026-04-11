import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/AppLayout';
import { usePayslip, usePayslips, useAnomalies } from '@/hooks/use-payslip-data';
import { useCurrency } from '@/hooks/use-profile';
import { formatDate } from '@/lib/demo-data';
import { AlertTriangle, ArrowLeft, FileText, GitCompare, MessageSquare } from 'lucide-react';

const PayslipDetail = () => {
  const { id } = useParams();
  const { data: slip, isLoading } = usePayslip(id);
  const { data: payslips } = usePayslips();
  const { data: allAnomalies } = useAnomalies();

  const anomalies = allAnomalies?.filter((a) => a.payslip_id === id) || [];
  const idx = payslips?.findIndex((s) => s.id === id) ?? -1;
  const prevSlip = idx > 0 ? payslips![idx - 1] : null;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-3xl">
          <Skeleton className="h-8 w-48" />
          <Card className="border-0 shadow-sm"><CardContent className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  if (!slip) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">Payslip not found</h2>
          <Link to="/vault"><Button variant="outline" className="mt-4 gap-2"><ArrowLeft className="h-4 w-4" /> Back to vault</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const rows = [
    { label: 'Gross pay', value: formatCurrency(slip.gross_pay) },
    { label: 'Taxable pay', value: slip.taxable_pay ? formatCurrency(slip.taxable_pay) : '—' },
    { label: 'Income tax', value: formatCurrency(slip.tax_amount) },
    ...(slip.ni_amount ? [{ label: 'National Insurance', value: formatCurrency(slip.ni_amount) }] : []),
    ...(slip.prsi_amount ? [{ label: 'PRSI', value: formatCurrency(slip.prsi_amount) }] : []),
    ...(slip.usc_amount ? [{ label: 'USC', value: formatCurrency(slip.usc_amount) }] : []),
    ...(slip.pension_amount ? [{ label: 'Pension', value: formatCurrency(slip.pension_amount) }] : []),
    ...(slip.student_loan_amount ? [{ label: 'Student loan', value: formatCurrency(slip.student_loan_amount) }] : []),
    ...(slip.bonus_amount ? [{ label: 'Bonus', value: formatCurrency(slip.bonus_amount) }] : []),
    ...(slip.overtime_amount ? [{ label: 'Overtime', value: formatCurrency(slip.overtime_amount) }] : []),
    { label: 'Total deductions', value: formatCurrency(slip.total_deductions) },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Link to="/vault"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{formatDate(slip.pay_date)}</h1>
            <p className="text-sm text-muted-foreground">{slip.employer_name}</p>
          </div>
          {anomalies.length > 0 && (
            <Badge variant="destructive" className="ml-auto gap-1">
              <AlertTriangle className="h-3 w-3" /> {anomalies.length} issue{anomalies.length !== 1 && 's'}
            </Badge>
          )}
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Pay breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-foreground">{row.value}</span>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Net pay</span>
                <span className="text-xl font-bold text-foreground">{formatCurrency(slip.net_pay)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {anomalies.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-anomaly" /> Flagged items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {anomalies.map((a) => (
                <div key={a.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{a.title}</h4>
                    <Badge variant="outline" className={`text-xs capitalize shrink-0 ${
                      a.severity === 'high' ? 'border-destructive text-destructive' :
                      a.severity === 'medium' ? 'border-anomaly text-anomaly' :
                      'border-warning text-warning'
                    }`}>{a.severity}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{a.description}</p>
                  <p className="mt-3 text-xs text-primary font-medium">💡 {a.suggested_action}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          {prevSlip && (
            <Link to={`/compare?current=${slip.id}&previous=${prevSlip.id}`}>
              <Button variant="outline" className="gap-2"><GitCompare className="h-4 w-4" /> Compare to {formatDate(prevSlip.pay_date)}</Button>
            </Link>
          )}
          <Link to={`/draft/${slip.id}`}>
            <Button variant="outline" className="gap-2"><MessageSquare className="h-4 w-4" /> Draft payroll query</Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          These findings are guidance only — not formal payroll or tax advice. Please confirm with your employer or a qualified professional.
        </p>
      </div>
    </AppLayout>
  );
};

export default PayslipDetail;
