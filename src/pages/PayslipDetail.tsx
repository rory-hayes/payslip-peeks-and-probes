import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/AppLayout';
import AnomalyExplanation from '@/components/AnomalyExplanation';
import { usePayslip, usePayslips, useAnomalies } from '@/hooks/use-payslip-data';
import { useCurrency } from '@/hooks/use-profile';
import { formatDate } from '@/lib/date-utils';
import { selectPayslipComparison } from '@/lib/payslip-comparison';
import { EXTRACTION_CONTEXT_FIELDS, formatExtractionContextValue } from '@/lib/payslip-extraction-details';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateAnomalyStatus } from '@/hooks/use-anomaly-status';
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, FileText, GitCompare, MessageSquare, RefreshCw, RotateCcw, Send } from 'lucide-react';

function readableExtractionField(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function readableLineItemKind(value: string): string {
  return value === 'employer_contribution'
    ? 'Employer contribution'
    : value.charAt(0).toUpperCase() + value.slice(1);
}

const PayslipDetail = () => {
  const { id } = useParams();
  const { data: slip, isLoading, error: payslipError, refetch: refetchPayslip } = usePayslip(id);
  const { data: realPayslips } = usePayslips();
  const { data: realAllAnomalies, isError: anomaliesError, refetch: refetchAnomalies } = useAnomalies();
  const { format: formatCurrency } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  const updateStatus = useUpdateAnomalyStatus();

  const allPayslips = realPayslips || [];
  const allAnomalies = realAllAnomalies || [];
  const anomalies = allAnomalies.filter((a) => a.payslip_id === id);
  const comparisonForSlip = slip?.status === 'confirmed'
    ? selectPayslipComparison(allPayslips, slip.id, null).comparison
    : null;
  const previousComparableSlip = comparisonForSlip?.current.id === slip?.id
    ? comparisonForSlip?.previous
    : null;

  const canRetry = slip && (slip.status as string) !== 'confirmed' && (slip.status as string) !== 'extracted';

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      const { error } = await supabase.functions.invoke('process-payslip', { body: { payslip_id: id } });
      if (error) {
        const msg = (error as { message?: string }).message || 'Re-processing failed.';
        toast({ title: 'Retry failed', description: msg, variant: 'destructive' });
      } else {
        toast({ title: 'Re-processing started', description: 'We\'ll refresh the data shortly.' });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['payslips'] }),
          queryClient.invalidateQueries({ queryKey: ['anomalies'] }),
        ]);
      }
    } catch (e) {
      toast({ title: 'Retry failed', description: 'Could not reach the processing service.', variant: 'destructive' });
    }
    setRetrying(false);
  };

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

  if (payslipError) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center" role="alert">
          <FileText className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">We couldn’t load this payslip.</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Your payslip has not been changed. Check your connection and try again before relying on these figures.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button className="min-h-11" onClick={() => void refetchPayslip()}>Try again</Button>
            <Button asChild variant="outline" className="min-h-11 gap-2">
              <Link to="/vault"><ArrowLeft className="h-4 w-4" /> Back to vault</Link>
            </Button>
          </div>
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
          <Button asChild variant="outline" className="mt-4 gap-2">
            <Link to="/vault"><ArrowLeft className="h-4 w-4" /> Back to vault</Link>
          </Button>
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
  const lineItems = slip.extraction_line_items ?? [];
  const fieldEvidence = slip.extraction_field_evidence ?? [];
  const yearToDate = slip.year_to_date;
  const extractionContextEntries = slip.extraction_context
    ? EXTRACTION_CONTEXT_FIELDS.flatMap(({ key, label }) => {
        const value = slip.extraction_context?.[key];
        return value ? [{ key, label, value: formatExtractionContextValue(key, value) }] : [];
      })
    : [];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="min-h-11 min-w-11">
            <Link to="/vault" aria-label="Back to saved payslips"><ArrowLeft aria-hidden="true" className="h-4 w-4" /></Link>
          </Button>
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

        {anomaliesError && (
          <Card className="border-warning/30 bg-warning/10 shadow-sm" role="alert">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">We couldn’t refresh the flagged items for this payslip. The pay figures above may still be available, but check again before relying on the issue list.</p>
              <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={() => void refetchAnomalies()}>Try again</Button>
            </CardContent>
          </Card>
        )}

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

        {(lineItems.length > 0 || yearToDate || fieldEvidence.length > 0 || extractionContextEntries.length > 0) && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Everything found on the payslip</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    These are transcribed figures and source snippets, not a payroll verdict. Check them against the original before relying on them.
                  </p>
                </div>
                {slip.extraction_confidence && (
                  <Badge variant="outline" className="capitalize">{slip.extraction_confidence} extraction confidence</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {yearToDate && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Year to date</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      { label: 'Gross pay', value: yearToDate.gross_pay },
                      { label: 'Income tax', value: yearToDate.tax },
                      { label: 'NI / PRSI', value: yearToDate.ni },
                      { label: 'Pension', value: yearToDate.pension },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-foreground">{item.value == null ? '—' : formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {extractionContextEntries.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Payroll context printed on the payslip</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Useful labels for understanding a deduction; they do not confirm that payroll is correct.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {extractionContextEntries.map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="text-right font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lineItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Line items</h3>
                  <div className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {lineItems.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                          <div>
                            <p className="font-medium text-foreground">{item.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {readableLineItemKind(item.kind)} · {item.reviewed ? 'checked by you' : `${item.confidence} confidence`}
                            </p>
                          </div>
                          <span className="font-semibold text-foreground">{item.amount == null ? '—' : formatCurrency(item.amount)}</span>
                        </div>
                        {item.year_to_date_amount != null && (
                          <p className="mt-2 text-xs text-muted-foreground">Year to date: {formatCurrency(item.year_to_date_amount)}</p>
                        )}
                        {item.evidence && (
                          <details className="mt-2 text-xs text-muted-foreground">
                            <summary className="cursor-pointer select-none">Show source snippet</summary>
                            <p className="mt-2 rounded bg-muted/40 px-2 py-1.5">“{item.evidence}”</p>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {fieldEvidence.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">Show figure evidence ({fieldEvidence.length})</summary>
                  <div className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {fieldEvidence.map((item, index) => (
                      <div key={`${item.field}-${index}`} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{readableExtractionField(item.field)}</p>
                          {item.evidence && <p className="mt-1 text-xs text-muted-foreground">“{item.evidence}”</p>}
                        </div>
                        <Badge variant="secondary" className="text-xs capitalize">{item.confidence}</Badge>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        )}

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
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs capitalize ${
                        a.severity === 'high' ? 'border-destructive text-destructive' :
                        a.severity === 'medium' ? 'border-anomaly text-anomaly' :
                        'border-warning text-warning'
                      }`}>{a.severity}</Badge>
                      <Badge variant="secondary" className="text-xs capitalize">{a.status}</Badge>
                    </div>
                  </div>
                  <div className="mt-3">
                    <AnomalyExplanation description={a.description} suggestedAction={a.suggested_action} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.status !== 'reviewed' && a.status !== 'resolved' && a.status !== 'raised' && (
                      <Button variant="outline" size="sm" className="min-h-11 gap-1 text-xs" onClick={() => updateStatus.mutate({ id: a.id, status: 'reviewed' })} disabled={updateStatus.isPending}>
                        <Eye className="h-3 w-3" /> Mark reviewed
                      </Button>
                    )}
                    {a.status !== 'raised' && a.status !== 'resolved' && (
                      <Button variant="outline" size="sm" className="min-h-11 gap-1 text-xs" onClick={() => updateStatus.mutate({ id: a.id, status: 'raised' })} disabled={updateStatus.isPending}>
                        <Send className="h-3 w-3" /> Raised with payroll
                      </Button>
                    )}
                    {a.status !== 'resolved' && (
                      <Button size="sm" className="min-h-11 gap-1 text-xs" onClick={() => updateStatus.mutate({ id: a.id, status: 'resolved' })} disabled={updateStatus.isPending}>
                        <CheckCircle className="h-3 w-3" /> Resolve
                      </Button>
                    )}
                    {a.status !== 'new' && (
                      <Button variant="ghost" size="sm" className="min-h-11 gap-1 text-xs text-muted-foreground" onClick={() => updateStatus.mutate({ id: a.id, status: 'new' })} disabled={updateStatus.isPending}>
                        <RotateCcw className="h-3 w-3" /> Reopen
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          {previousComparableSlip && (
            <Button asChild variant="outline" className="gap-2">
              <Link to={`/compare?current=${slip.id}&previous=${previousComparableSlip.id}`}><GitCompare className="h-4 w-4" /> Compare to {formatDate(previousComparableSlip.pay_date)}</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="gap-2">
            <Link to={`/draft/${slip.id}`}><MessageSquare className="h-4 w-4" /> Draft payroll query</Link>
          </Button>
          {canRetry && (
            <Button variant="outline" className="gap-2" onClick={handleRetry} disabled={retrying}>
              <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Retrying…' : 'Retry processing'}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          These findings are guidance only — not formal payroll or tax advice. Please confirm with your employer or a qualified professional.
        </p>
      </div>
    </AppLayout>
  );
};

export default PayslipDetail;
