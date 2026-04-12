import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/AppLayout';
import UpgradePrompt from '@/components/UpgradePrompt';
import { usePayslip, useAnomalies } from '@/hooks/use-payslip-data';
import { useProfile } from '@/hooks/use-profile';
import { useUsage } from '@/hooks/use-usage';
import { formatDate } from '@/lib/date-utils';
import { ArrowLeft, Copy, Mail, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function safeDateLabel(raw: string | null | undefined): string {
  if (!raw) return 'a recent pay period';
  const formatted = formatDate(raw);
  if (!formatted || formatted === '—' || formatted.toLowerCase().includes('invalid')) {
    return 'a recent pay period';
  }
  return formatted;
}

function buildDraft(
  dateLabel: string,
  employerName: string | null,
  anomalies: { title: string; description?: string | null; suggested_action?: string | null }[],
  firstName: string | null,
) {
  const greeting = 'Dear Payroll Team,';
  const opening = `I'm writing regarding my payslip dated ${dateLabel}.`;

  let middle: string;
  if (anomalies.length > 0) {
    const items = anomalies.map((a) => {
      let line = `• ${a.title}`;
      if (a.description) {
        // Take first sentence of description for conciseness
        const firstSentence = a.description.split(/(?<=\.)\s/)[0];
        line += ` — ${firstSentence}`;
      }
      return line;
    });
    middle =
      `While reviewing my payslip, I noticed the following:\n\n${items.join('\n')}\n\n` +
      `Could you please confirm whether these figures are correct? If there has been a change, I'd appreciate a brief explanation.`;
  } else {
    middle =
      `I have a question about my pay this period and would appreciate your help clarifying the details. ` +
      `Could you please confirm the breakdown of deductions and net pay?`;
  }

  const signOff = firstName
    ? `Kind regards,\n${firstName}`
    : 'Kind regards';

  return `${greeting}\n\n${opening}\n\n${middle}\n\nI'd be happy to discuss further if needed.\n\n${signOff}`;
}

function buildSubject(dateLabel: string, hasAnomalies: boolean): string {
  if (hasAnomalies) {
    return `Query about my ${dateLabel} payslip`;
  }
  return `Clarification on my ${dateLabel} payslip`;
}

const DraftQuery = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { data: slip, isLoading } = usePayslip(id);
  const { data: allAnomalies } = useAnomalies();
  const { data: profile } = useProfile();
  const { canDraft, draftsRemaining, isPremium } = useUsage();
  const anomalies = allAnomalies?.filter((a) => a.payslip_id === id) || [];

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize once data loads
  if (slip && !initialized) {
    const dateLabel = safeDateLabel(slip.pay_date);
    setSubject(buildSubject(dateLabel, anomalies.length > 0));
    setBody(buildDraft(dateLabel, slip.employer_name, anomalies, profile?.first_name ?? null));
    setToEmail(profile?.payroll_email ?? '');
    setInitialized(true);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    toast({ title: 'Copied to clipboard', description: 'Paste this into your email client.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const mailtoLink = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-2xl">
          <Skeleton className="h-8 w-48" />
          <Card className="border-0 shadow-sm"><CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent></Card>
        </div>
      </AppLayout>
    );
  }

  if (!slip) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Payslip not found.</p>
          <Link to="/vault"><Button variant="outline" className="mt-4">Back to vault</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Link to={`/payslip/${id}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Draft payroll query</h1>
            <p className="text-sm text-muted-foreground">
              For payslip dated {safeDateLabel(slip.pay_date)}
              {slip.employer_name ? ` · ${slip.employer_name}` : ''}
            </p>
          </div>
        </div>

        {!canDraft ? (
          <UpgradePrompt
            title="Draft limit reached"
            description={`You've used your ${2} free drafts this month. Upgrade to Plus for unlimited drafts.`}
          />
        ) : (
          <>
            {!isPremium && (
              <p className="text-xs text-muted-foreground">
                {draftsRemaining} draft{draftsRemaining !== 1 ? 's' : ''} remaining this month
              </p>
            )}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Your message</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input
                    type="email"
                    placeholder="payroll@company.com"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                  />
                  {!toEmail && (
                    <p className="text-xs text-muted-foreground">
                      Add your payroll email in <Link to="/settings" className="text-primary hover:underline">Settings</Link> to prefill this.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="resize-y" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Edit this message before sending. {anomalies.length > 0
                    ? "We've drafted it based on the issues flagged on this payslip."
                    : "We've prepared a general clarification request for this payslip."}
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {canDraft && (
          <>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleCopy} className="gap-2">
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </Button>
              <a href={mailtoLink}>
                <Button variant="outline" className="gap-2"><Mail className="h-4 w-4" /> Open in email</Button>
              </a>
            </div>

            <p className="text-xs text-muted-foreground">
              This draft is a starting point. Review and personalise it before sending. PayCheck does not send emails on your behalf.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default DraftQuery;
