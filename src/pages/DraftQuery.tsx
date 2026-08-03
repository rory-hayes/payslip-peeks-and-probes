import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type CreatedDraft = { id: string; subject: string | null; body: string | null };
type CreateDraftResponse = { code?: string; draft?: CreatedDraft };

function createDraftResponse(value: unknown): CreateDraftResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  const draft = response.draft;
  const hasDraft = draft
    && typeof draft === 'object'
    && !Array.isArray(draft)
    && typeof (draft as Record<string, unknown>).id === 'string'
    && (typeof (draft as Record<string, unknown>).subject === 'string'
      || (draft as Record<string, unknown>).subject === null)
    && (typeof (draft as Record<string, unknown>).body === 'string'
      || (draft as Record<string, unknown>).body === null);

  return {
    code: typeof response.code === 'string' ? response.code : undefined,
    draft: hasDraft ? draft as CreatedDraft : undefined,
  };
}

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
  const { user } = useAuth();
  const { data: slip, isLoading } = usePayslip(id);
  const { data: allAnomalies } = useAnomalies();
  const { data: profile } = useProfile();
  const {
    accessError,
    accessReady,
    canDraft,
    draftsRemaining,
    isPremium,
    refetchAccess,
  } = useUsage();
  const anomalies = useMemo(
    () => allAnomalies?.filter((a) => a.payslip_id === id) || [],
    [allAnomalies, id],
  );

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftLimitReached, setDraftLimitReached] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const canUseDraft = accessReady && canDraft && !draftLimitReached;

  useEffect(() => {
    if (!slip || !user || initialized || !accessReady) return;

    const dateLabel = safeDateLabel(slip.pay_date);
    const initialSubject = buildSubject(dateLabel, anomalies.length > 0);
    const initialBody = buildDraft(dateLabel, slip.employer_name, anomalies, profile?.first_name ?? null);
    const initialEmail = profile?.payroll_email ?? '';

    const initialiseDraft = async () => {
      setSubject(initialSubject);
      setBody(initialBody);
      setToEmail(initialEmail);
      setInitialized(true);

      if (!canUseDraft) return;

      const { data, error: createError } = await supabase.functions.invoke('create-issue-draft', {
        body: {
          payslipId: slip.id,
          subject: initialSubject,
          body: initialBody,
        },
      });
      const response = createDraftResponse(data);

      if (response?.code === 'draft_limit_reached') {
          setDraftLimitReached(true);
          toast({
            title: 'Draft limit reached',
            description: 'You have used your two free drafts this Dublin calendar month. See Plus options for more drafts.',
            variant: 'destructive',
          });
        return;
      }

      if (createError || !response?.draft) {
        toast({
          title: 'Could not save draft',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setDraftId(response.draft.id);
      setSubject(response.draft.subject || initialSubject);
      setBody(response.draft.body || initialBody);
    };

    void initialiseDraft();
  }, [accessReady, anomalies, canUseDraft, initialized, profile?.first_name, profile?.payroll_email, slip, toast, user]);

  useEffect(() => {
    if (!draftId || !initialized) return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = window.setTimeout(() => {
      void supabase
        .from('issue_drafts')
        .update({ subject, body, status: 'draft' })
        .eq('id', draftId);
    }, 300);

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [body, draftId, initialized, subject]);

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

        {!accessReady ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-8 text-center">
              <h2 className="text-base font-semibold text-foreground">
                {accessError ? 'We couldn’t verify draft access' : 'Checking draft access'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {accessError
                  ? 'Check your connection, then try again before creating a payroll message.'
                  : 'We’re confirming your account and monthly allowance before we create a draft.'}
              </p>
              {accessError ? <Button className="mt-4" onClick={() => void refetchAccess()}>Try again</Button> : null}
            </CardContent>
          </Card>
        ) : !canUseDraft ? (
          <UpgradePrompt
            title="Draft limit reached"
            description={`You've used your ${2} free drafts this Dublin calendar month. See Plus options for more drafts.`}
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

        {canUseDraft && (
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
              This draft is a starting point. Review and personalise it before sending. Payslip Insights does not send emails on your behalf.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default DraftQuery;
