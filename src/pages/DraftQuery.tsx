import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router';
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
import { PAID_DRAFTS_PER_MONTH, useUsage } from '@/hooks/use-usage';
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
  const { data: slip, isLoading, error: payslipError, refetch: refetchPayslip } = usePayslip(id);
  const {
    data: allAnomalies,
    isLoading: anomaliesLoading,
    isError: anomaliesError,
    refetch: refetchAnomalies,
  } = useAnomalies();
  const { data: profile } = useProfile();
  const {
    accessError,
    accessReady,
    canDraft,
    draftLimit,
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
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [draftPersistenceError, setDraftPersistenceError] = useState<'create' | 'update' | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const saveVersionRef = useRef(0);
  const lastPersistedDraftRef = useRef<{ id: string; subject: string; body: string } | null>(null);
  const canUseDraft = accessReady && canDraft && !draftLimitReached;

  const saveExistingDraft = useCallback(async (
    draftSnapshot: { id: string; subject: string; body: string },
    saveVersion: number,
  ) => {
    setIsSavingEdits(true);
    setDraftPersistenceError(null);

    try {
      const { error } = await supabase
        .from('issue_drafts')
        .update({ subject: draftSnapshot.subject, body: draftSnapshot.body, status: 'draft' })
        .eq('id', draftSnapshot.id);

      if (saveVersion !== saveVersionRef.current) return;

      if (error) {
        setDraftPersistenceError('update');
        return;
      }

      lastPersistedDraftRef.current = draftSnapshot;
    } catch {
      if (saveVersion === saveVersionRef.current) {
        setDraftPersistenceError('update');
      }
    } finally {
      if (saveVersion === saveVersionRef.current) {
        setIsSavingEdits(false);
      }
    }
  }, []);

  const createOrRestoreDraft = useCallback(async (
    nextSubject: string,
    nextBody: string,
    preserveLocalEdits = false,
  ) => {
    if (!slip || !canUseDraft) return;

    setIsCreatingDraft(true);
    setDraftPersistenceError(null);

    try {
      const { data, error: createError } = await supabase.functions.invoke('create-issue-draft', {
        body: {
          payslipId: slip.id,
          subject: nextSubject,
          body: nextBody,
        },
      });
      const response = createDraftResponse(data);

      if (response?.code === 'draft_limit_reached') {
        setDraftLimitReached(true);
        toast({
          title: 'Draft allowance used',
          description: isPremium
            ? `You have used your ${draftLimit} payroll-message drafts for this calendar month.`
            : `You have used your ${draftLimit} Free drafts for this calendar month. See Plus options for more.`,
          variant: 'destructive',
        });
        return;
      }

      if (createError || !response?.draft) {
        setDraftPersistenceError('create');
        return;
      }

      const savedSubject = response.draft.subject || nextSubject;
      const savedBody = response.draft.body || nextBody;
      lastPersistedDraftRef.current = { id: response.draft.id, subject: savedSubject, body: savedBody };
      setDraftId(response.draft.id);
      // A timed-out create may already have succeeded server-side. On an
      // explicit retry, keep any edits the person made after the error and let
      // the normal autosave update that idempotently recovered draft.
      setSubject(preserveLocalEdits ? nextSubject : savedSubject);
      setBody(preserveLocalEdits ? nextBody : savedBody);
    } catch {
      setDraftPersistenceError('create');
    } finally {
      setIsCreatingDraft(false);
    }
  }, [canUseDraft, draftLimit, isPremium, slip, toast]);

  useEffect(() => {
    if (!slip || !user || initialized || !accessReady || anomaliesLoading) return;

    const dateLabel = safeDateLabel(slip.pay_date);
    const initialSubject = buildSubject(dateLabel, anomalies.length > 0);
    const initialBody = buildDraft(dateLabel, slip.employer_name, anomalies, profile?.first_name ?? null);
    const initialEmail = profile?.payroll_email ?? '';

    const initialiseDraft = () => {
      setSubject(initialSubject);
      setBody(initialBody);
      setToEmail(initialEmail);
      setInitialized(true);

      if (!canUseDraft) return;

      void createOrRestoreDraft(initialSubject, initialBody);
    };

    initialiseDraft();
  }, [accessReady, anomalies, anomaliesLoading, canUseDraft, createOrRestoreDraft, initialized, profile?.first_name, profile?.payroll_email, slip, user]);

  useEffect(() => {
    if (!draftId || !initialized) return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    const currentDraft = { id: draftId, subject, body };
    const lastPersistedDraft = lastPersistedDraftRef.current;
    if (
      lastPersistedDraft
      && lastPersistedDraft.id === currentDraft.id
      && lastPersistedDraft.subject === currentDraft.subject
      && lastPersistedDraft.body === currentDraft.body
    ) {
      return;
    }

    const saveVersion = ++saveVersionRef.current;
    setIsSavingEdits(true);
    setDraftPersistenceError(null);

    saveTimeoutRef.current = window.setTimeout(() => {
      void saveExistingDraft(currentDraft, saveVersion);
    }, 300);

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [body, draftId, initialized, saveExistingDraft, subject]);

  const handleRetryDraftSave = () => {
    if (!draftId) {
      void createOrRestoreDraft(subject, body, true);
      return;
    }

    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    const saveVersion = ++saveVersionRef.current;
    void saveExistingDraft({ id: draftId, subject, body }, saveVersion);
  };

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      toast({ title: 'Copied to clipboard', description: 'Paste this into your email client.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Couldn’t copy the draft',
        description: 'Select the text and copy it manually before you leave this page.',
        variant: 'destructive',
      });
    }
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

  if (payslipError) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center" role="alert">
          <h2 className="text-lg font-semibold text-foreground">We couldn’t load this payslip.</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Your saved draft has not been changed. Check your connection and try again before creating a payroll message.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button className="min-h-11" onClick={() => void refetchPayslip()}>Try again</Button>
            <Button asChild variant="outline" className="min-h-11"><Link to="/vault">Back to vault</Link></Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!slip) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Payslip not found.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/vault">Back to vault</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="min-h-11 min-w-11">
            <Link to={`/payslip/${id}`} aria-label="Back to payslip"><ArrowLeft aria-hidden="true" className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Draft payroll query</h1>
            <p className="text-sm text-muted-foreground">
              For payslip dated {safeDateLabel(slip.pay_date)}
              {slip.employer_name ? ` · ${slip.employer_name}` : ''}
            </p>
          </div>
        </div>

        {anomaliesError && (
          <Card className="border-warning/30 bg-warning/10 shadow-sm" role="alert">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">We couldn’t load flagged items for this payslip. This draft uses general wording until those items are available.</p>
              <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={() => void refetchAnomalies()}>Try again</Button>
            </CardContent>
          </Card>
        )}

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
        ) : anomaliesLoading ? (
          <Card className="border-0 shadow-sm" role="status" aria-live="polite">
            <CardContent className="py-8 text-center">
              <h2 className="text-base font-semibold text-foreground">Loading flagged items</h2>
              <p className="mt-2 text-sm text-muted-foreground">We’re checking this payslip before preparing your message.</p>
            </CardContent>
          </Card>
        ) : !canUseDraft ? (
          isPremium ? (
            <Card className="border-border bg-muted/30">
              <CardContent className="p-6 text-center">
                <h2 className="font-semibold text-foreground">Draft allowance used</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your plan includes up to {draftLimit} payroll-message drafts per calendar month. You can create another when the next month begins.
                </p>
              </CardContent>
            </Card>
          ) : (
            <UpgradePrompt
              title="Draft allowance used"
              description={`You've used your ${draftLimit} Free drafts this calendar month. See Plus options for up to ${PAID_DRAFTS_PER_MONTH} drafts per month.`}
            />
          )
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {draftsRemaining} of {draftLimit} payroll-message draft{draftLimit !== 1 ? 's' : ''} remaining this month
            </p>
            {isCreatingDraft && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                Saving your draft securely…
              </p>
            )}
            {draftPersistenceError && (
              <Card className="border-warning/30 bg-warning/10 shadow-sm" role="alert">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-foreground">
                    {draftPersistenceError === 'create'
                      ? 'We couldn’t save this draft yet. Copy it into your email or try again.'
                      : 'Your latest edits could not be saved. Copy the message before leaving, then try saving again.'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 shrink-0"
                    onClick={handleRetryDraftSave}
                    disabled={isCreatingDraft || isSavingEdits}
                  >
                    Try saving again
                  </Button>
                </CardContent>
              </Card>
            )}
            {!draftPersistenceError && isSavingEdits && !isCreatingDraft && (
              <p className="text-xs text-muted-foreground" role="status" aria-live="polite">Saving your latest edits…</p>
            )}
            {!draftPersistenceError && draftId && !isSavingEdits && !isCreatingDraft && (
              <p className="text-xs text-muted-foreground" role="status">Draft saved</p>
            )}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Your message</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="draft-to">To</Label>
                  <Input
                    id="draft-to"
                    type="email"
                    placeholder="payroll@company.com"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    disabled={isCreatingDraft}
                  />
                  {!toEmail && (
                    <p className="text-xs text-muted-foreground">
                      Add your payroll email in <Link to="/settings" className="text-primary hover:underline">Settings</Link> to prefill this.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draft-subject">Subject</Label>
                  <Input id="draft-subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isCreatingDraft} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draft-message">Message</Label>
                  <Textarea id="draft-message" value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="resize-y" disabled={isCreatingDraft} />
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
              <Button onClick={() => void handleCopy()} className="gap-2">
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <a href={mailtoLink}><Mail className="h-4 w-4" /> Open in email</a>
              </Button>
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
