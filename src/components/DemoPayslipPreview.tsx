import { AlertTriangle, ArrowRight, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AnomalyExplanation from '@/components/AnomalyExplanation';
import { formatDate } from '@/lib/date-utils';
import { EXTRACTION_CONTEXT_FIELDS, formatExtractionContextValue } from '@/lib/payslip-extraction-details';
import type { AnomalyResult, Payslip } from '@/lib/types';

export interface DemoPayslipPreviewState {
  anomaly?: AnomalyResult | null;
  payslip: Payslip;
}

interface DemoPayslipPreviewProps {
  onOpenChange: (open: boolean) => void;
  onSignUp: () => void;
  preview: DemoPayslipPreviewState | null;
}

function formatDemoCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    currency: 'GBP',
    style: 'currency',
  }).format(value);
}

/**
 * A safe, dashboard-local product preview. It never links a visitor into a
 * protected account route or makes a claim about their own pay.
 */
const DemoPayslipPreview = ({ onOpenChange, onSignUp, preview }: DemoPayslipPreviewProps) => {
  const payslip = preview?.payslip;
  const anomaly = preview?.anomaly;
  const extractionContextEntries = payslip?.extraction_context
    ? EXTRACTION_CONTEXT_FIELDS.flatMap(({ key, label }) => {
        const value = payslip.extraction_context?.[key];
        return value ? [{ key, label, value: formatExtractionContextValue(key, value) }] : [];
      })
    : [];

  return (
    <Dialog open={Boolean(preview)} onOpenChange={onOpenChange}>
      <DialogContent className="pi-demo-preview-dialog">
        {payslip ? (
          <>
            <DialogHeader className="pi-demo-preview__header">
              <p className="pi-demo-preview__eyebrow">Sample payslip check</p>
              <DialogTitle>{formatDate(payslip.pay_date)} payslip</DialogTitle>
              <DialogDescription className="pi-demo-preview__description">
                {payslip.employer_name} · Sample UK monthly pay · Read-only
              </DialogDescription>
            </DialogHeader>

            <div className="pi-demo-preview__body">
              <section className="pi-demo-preview__pay" aria-label="Sample pay breakdown">
                <div>
                  <span>Take-home pay</span>
                  <strong>{formatDemoCurrency(payslip.net_pay)}</strong>
                </div>
                <dl>
                  <div>
                    <dt>Gross pay</dt>
                    <dd>{formatDemoCurrency(payslip.gross_pay)}</dd>
                  </div>
                  <div>
                    <dt>Total deductions</dt>
                    <dd>{formatDemoCurrency(payslip.total_deductions)}</dd>
                  </div>
                </dl>
              </section>

              {(payslip.extraction_line_items?.length || payslip.year_to_date || extractionContextEntries.length > 0) ? (
                <section className="pi-demo-preview__extraction" aria-labelledby="sample-extraction-heading">
                  <div className="pi-demo-preview__section-heading">
                    <span className="pi-demo-preview__check" aria-hidden="true"><FileText /></span>
                    <div>
                      <p className="pi-demo-preview__eyebrow">What the extractor found</p>
                      <h3 id="sample-extraction-heading">Figures you can check against the original</h3>
                    </div>
                  </div>
                  <p className="pi-demo-preview__plain-copy">
                    Line items, payroll context, year-to-date figures and short source snippets stay together so you can spot what needs checking before you confirm it.
                  </p>
                  {payslip.extraction_line_items?.length ? (
                    <div className="pi-demo-preview__line-items" aria-label="Sample extracted line items">
                      {payslip.extraction_line_items.map((item) => (
                        <div key={item.label} className="pi-demo-preview__line-item">
                          <div>
                            <strong>{item.label}</strong>
                            <span>{item.kind === 'employer_contribution' ? 'Employer contribution' : item.kind} · {item.confidence} confidence</span>
                          </div>
                          <b>{item.amount == null ? '—' : formatDemoCurrency(item.amount)}</b>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {payslip.year_to_date ? (
                    <div className="pi-demo-preview__ytd" aria-label="Sample year-to-date figures">
                      {[
                        ['Gross YTD', payslip.year_to_date.gross_pay],
                        ['Tax YTD', payslip.year_to_date.tax],
                        ['NI YTD', payslip.year_to_date.ni],
                        ['Pension YTD', payslip.year_to_date.pension],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <span>{label}</span>
                          <strong>{typeof value === 'number' ? formatDemoCurrency(value) : '—'}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {extractionContextEntries.length > 0 ? (
                    <div className="pi-demo-preview__context" aria-label="Sample payroll context">
                      <p>Payroll context printed on the payslip</p>
                      <span>Useful labels to check against the original; not a payroll verdict.</span>
                      <div>
                        {extractionContextEntries.map((item) => (
                          <div key={item.key}>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {anomaly ? (
                <section className="pi-demo-preview__insight" aria-labelledby="sample-insight-heading">
                  <div className="pi-demo-preview__section-heading">
                    <span className="pi-demo-preview__warning" aria-hidden="true"><AlertTriangle /></span>
                    <div>
                      <p className="pi-demo-preview__eyebrow">Change worth checking</p>
                      <h3 id="sample-insight-heading">{anomaly.title}</h3>
                    </div>
                  </div>
                  <AnomalyExplanation description={anomaly.description} suggestedAction={anomaly.suggested_action} />
                </section>
              ) : (
                <section className="pi-demo-preview__insight" aria-labelledby="sample-insight-heading">
                  <div className="pi-demo-preview__section-heading">
                    <span className="pi-demo-preview__check" aria-hidden="true"><CheckCircle2 /></span>
                    <div>
                      <p className="pi-demo-preview__eyebrow">Pay history</p>
                      <h3 id="sample-insight-heading">This sample is in line with the prior month</h3>
                    </div>
                  </div>
                  <p className="pi-demo-preview__plain-copy">
                    A checked payslip becomes a useful reference point for the next payday. When a number moves, you can see the change before deciding what to do.
                  </p>
                </section>
              )}

              <section className="pi-demo-preview__next" aria-labelledby="sample-next-heading">
                <FileText aria-hidden="true" />
                <div>
                  <h3 id="sample-next-heading">Then turn confirmed pay into a payday plan</h3>
                  <p>Set aside your essentials, everyday spending and a buffer. This is a planning guide, not a bank balance or financial advice.</p>
                </div>
              </section>
            </div>

            <DialogFooter className="pi-demo-preview__actions">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="pi-demo-preview__secondary-action">Keep exploring</Button>
              </DialogClose>
              <Button type="button" className="pi-demo-preview__primary-action" onClick={onSignUp}>
                Sign up to check mine <ArrowRight aria-hidden="true" />
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default DemoPayslipPreview;
