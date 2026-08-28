import { useState, useCallback, useEffect, useRef, type FormEvent } from 'react';
import { Link } from 'react-router';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, AlertCircle, ClipboardCheck, ExternalLink, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/date-utils';
import { useUsage } from '@/hooks/use-usage';
import {
  EXTRACTION_CONTEXT_FIELDS,
  formatExtractionContextValue,
  normalizeExtractionDetails,
} from '@/lib/payslip-extraction-details';
import {
  PAYSLIP_ALLOWED_FILE_TYPES,
  PAYSLIP_MAX_FILE_BYTES,
  parseIssuedPayslipUpload,
} from '@/lib/payslip-upload';

type UploadState = 'idle' | 'uploading' | 'processing' | 'opening_review' | 'review' | 'success' | 'error';

interface ReviewFields {
  pay_date: string;
  employer_name: string;
  gross_pay: string;
  net_pay: string;
  tax_amount: string;
  ni_amount: string;
  prsi_amount: string;
  usc_amount: string;
  pension_amount: string;
  total_deductions: string;
}

interface FieldMeta {
  extracted: boolean; // was auto-extracted (vs blank)
  edited: boolean;    // user changed it
}

type RequiredReviewField = 'pay_date' | 'gross_pay' | 'net_pay';
type ReviewExtractionDetails = ReturnType<typeof normalizeExtractionDetails>;

function emptyReviewExtractionDetails(): ReviewExtractionDetails {
  return normalizeExtractionDetails(null);
}

function formatReviewMoney(value: number, currency: 'GBP' | 'EUR'): string {
  return new Intl.NumberFormat(currency === 'EUR' ? 'en-IE' : 'en-GB', {
    currency,
    style: 'currency',
  }).format(value);
}

interface PayslipUploadProps {
  onUploadComplete?: (payslipId: string) => void;
  resumeReviewId?: string | null;
}

const PayslipUpload = ({ onUploadComplete, resumeReviewId = null }: PayslipUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    accessError,
    accessReady,
    canUpload,
    uploadsRemaining,
    uploadLimit,
    uploadQuotaScope,
    isPremium,
    refetchAccess,
  } = useUsage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [failedPayslipId, setFailedPayslipId] = useState<string | null>(null);
  const [completionState, setCompletionState] = useState<'confirmed' | 'already_saved' | null>(null);

  // Review state
  const [reviewPayslipId, setReviewPayslipId] = useState<string | null>(null);
  const [reviewCountry, setReviewCountry] = useState<string>('UK');
  const [reviewFields, setReviewFields] = useState<ReviewFields>({
    pay_date: '', employer_name: '', gross_pay: '', net_pay: '',
    tax_amount: '', ni_amount: '', prsi_amount: '', usc_amount: '',
    pension_amount: '', total_deductions: '',
  });
  const [fieldMeta, setFieldMeta] = useState<Record<string, FieldMeta>>({});
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewErrors, setReviewErrors] = useState<Partial<Record<RequiredReviewField, string>>>({});
  const [reviewExtraction, setReviewExtraction] = useState<ReviewExtractionDetails>(() => emptyReviewExtractionDetails());
  const reviewInputRefs = useRef<Partial<Record<RequiredReviewField, HTMLInputElement | null>>>({});
  const [originalPayslipUrl, setOriginalPayslipUrl] = useState<string | null>(null);
  const [originalPayslipState, setOriginalPayslipState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');

  useEffect(() => {
    let cancelled = false;

    const prepareOriginalPayslip = async () => {
      if (!user || !reviewPayslipId) {
        setOriginalPayslipUrl(null);
        setOriginalPayslipState('unavailable');
        return;
      }

      setOriginalPayslipUrl(null);
      setOriginalPayslipState('loading');

      try {
        const { data, error } = await supabase.functions.invoke('get-payslip-original-url', {
          body: { payslipId: reviewPayslipId },
        });

        if (cancelled) return;

        if (error || typeof data?.url !== 'string') {
          logError('payslip_source_unavailable', 'Could not create a private source document link');
          setOriginalPayslipState('unavailable');
          return;
        }

        setOriginalPayslipUrl(data.url);
        setOriginalPayslipState('ready');
      } catch {
        if (!cancelled) {
          logError('payslip_source_unavailable', 'Could not create a private source document link');
          setOriginalPayslipState('unavailable');
        }
      }
    };

    void prepareOriginalPayslip();

    return () => {
      cancelled = true;
    };
  }, [reviewPayslipId, user]);

  useEffect(() => {
    if (!resumeReviewId) return;

    let cancelled = false;

    const resumeReview = async () => {
      setState('opening_review');
      setErrorMsg('');
      setFailedPayslipId(null);

      try {
        const [
          { data: payslip, error: payslipError },
          { data: extraction, error: extractionError },
        ] = await Promise.all([
          supabase
            .from('payslips')
            .select('status, pay_date, country, file_name')
            .eq('id', resumeReviewId)
            .single(),
          supabase
            .from('payslip_extractions')
            .select('*')
            .eq('payslip_id', resumeReviewId)
            .single(),
        ]);

        if (cancelled) return;

        if (payslipError || extractionError || !payslip || !extraction || payslip.status !== 'needs_review') {
          setState('idle');
          toast({
            title: 'This review is not available',
            description: 'It may already be confirmed, or it could not be opened. Refresh your vault and try again.',
            variant: 'destructive',
          });
          return;
        }

        const fields: ReviewFields = {
          pay_date: payslip.pay_date || '',
          employer_name: '',
          gross_pay: extraction.gross_pay != null ? String(extraction.gross_pay) : '',
          net_pay: extraction.net_pay != null ? String(extraction.net_pay) : '',
          tax_amount: extraction.tax_amount != null ? String(extraction.tax_amount) : '',
          ni_amount: extraction.national_insurance_amount != null ? String(extraction.national_insurance_amount) : '',
          prsi_amount: extraction.prsi_amount != null ? String(extraction.prsi_amount) : '',
          usc_amount: extraction.usc_amount != null ? String(extraction.usc_amount) : '',
          pension_amount: extraction.pension_amount != null ? String(extraction.pension_amount) : '',
          total_deductions: extraction.total_deductions != null ? String(extraction.total_deductions) : '',
        };
        const meta: Record<string, FieldMeta> = {};
        for (const [key, value] of Object.entries(fields)) {
          meta[key] = { extracted: value !== '', edited: false };
        }

        setReviewCountry(payslip.country || 'UK');
        setReviewFields(fields);
        setFieldMeta(meta);
        setReviewExtraction(normalizeExtractionDetails(extraction));
        setReviewPayslipId(resumeReviewId);
        setFileName(payslip.file_name || 'Payslip');
        setState('review');
      } catch {
        if (cancelled) return;
        setState('idle');
        toast({
          title: 'This review is not available',
          description: 'It may already be confirmed, or it could not be opened. Refresh your vault and try again.',
          variant: 'destructive',
        });
      }
    };

    void resumeReview();

    return () => {
      cancelled = true;
    };
  }, [resumeReviewId, toast]);

  useEffect(() => {
    if (state === 'error') errorHeadingRef.current?.focus();
  }, [errorMsg, state]);

  const resetState = () => {
    setState('idle');
    setProgress(0);
    setFileName('');
    setErrorMsg('');
    setFailedPayslipId(null);
    setCompletionState(null);
    setOriginalPayslipUrl(null);
    setOriginalPayslipState('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setReviewPayslipId(null);
    setReviewFields({
      pay_date: '', employer_name: '', gross_pay: '', net_pay: '',
      tax_amount: '', ni_amount: '', prsi_amount: '', usc_amount: '',
      pension_amount: '', total_deductions: '',
    });
    setFieldMeta({});
    setReviewErrors({});
    setReviewExtraction(emptyReviewExtractionDetails());
  };

  const updateField = (key: keyof ReviewFields, value: string) => {
    setReviewFields(prev => ({ ...prev, [key]: value }));
    setFieldMeta(prev => ({ ...prev, [key]: { ...prev[key], edited: true } }));
    if (key === 'pay_date' || key === 'gross_pay' || key === 'net_pay') {
      setReviewErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  };

  const changeReviewCountry = (country: 'UK' | 'Ireland') => {
    setReviewCountry(country);
    setReviewFields((current) => country === 'Ireland'
      ? { ...current, ni_amount: '' }
      : { ...current, prsi_amount: '', usc_amount: '' });
  };

  const invalidatePayslipQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['payslips'] }),
      queryClient.invalidateQueries({ queryKey: ['anomalies'] }),
      queryClient.invalidateQueries({ queryKey: ['usage'] }),
    ]);
  }, [queryClient]);

  const showProcessingFailure = useCallback((payslipId: string, eventType: string) => {
    logError(eventType, 'Payslip processing could not be completed', { payslipId });
    setFailedPayslipId(payslipId);
    setErrorMsg('We couldn\'t complete the automatic check. Your file is still in the vault, so you can retry it, enter the figures yourself, or upload a different copy.');
    setState('error');
    toast({
      title: 'Payslip needs another try',
      description: 'We couldn\'t complete the check. You can retry it now.',
      variant: 'destructive',
    });
  }, [toast]);

  const processPayslip = useCallback(async (payslipId: string): Promise<boolean> => {
    setFailedPayslipId(null);
    setCompletionState(null);
    setErrorMsg('');
    setProgress(80);
    setState('processing');

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('process-payslip', {
        body: { payslip_id: payslipId },
      });

      if (fnError) {
        showProcessingFailure(payslipId, 'processing_failed');
        return false;
      }

      const [
        { data: updatedPayslip, error: payslipFetchError },
        { data: extraction, error: extractionFetchError },
      ] = await Promise.all([
        supabase.from('payslips').select('status, pay_date, pay_period_start, pay_period_end, country, file_name').eq('id', payslipId).single(),
        supabase.from('payslip_extractions').select('*').eq('payslip_id', payslipId).single(),
      ]);

      if (payslipFetchError || extractionFetchError || !updatedPayslip) {
        showProcessingFailure(payslipId, 'processing_result_unavailable');
        return false;
      }

      if (updatedPayslip.status === 'failed' || extraction?.extraction_status === 'failed') {
        showProcessingFailure(payslipId, 'processing_result_failed');
        return false;
      }

      if (updatedPayslip.status === 'needs_review') {
        // Populate review form with extracted values
        const ext = extraction || {} as Record<string, unknown>;
        const country = (updatedPayslip.country || 'UK') as string;
        setReviewCountry(country);

        const fields: ReviewFields = {
          pay_date: updatedPayslip.pay_date || '',
          employer_name: (fnData?.extraction?.employer_name as string) || '',
          gross_pay: ext.gross_pay != null ? String(ext.gross_pay) : '',
          net_pay: ext.net_pay != null ? String(ext.net_pay) : '',
          tax_amount: ext.tax_amount != null ? String(ext.tax_amount) : '',
          ni_amount: ext.national_insurance_amount != null ? String(ext.national_insurance_amount) : '',
          prsi_amount: ext.prsi_amount != null ? String(ext.prsi_amount) : '',
          usc_amount: ext.usc_amount != null ? String(ext.usc_amount) : '',
          pension_amount: ext.pension_amount != null ? String(ext.pension_amount) : '',
          total_deductions: ext.total_deductions != null ? String(ext.total_deductions) : '',
        };
        setReviewFields(fields);
        setReviewExtraction(normalizeExtractionDetails(extraction));

        // Track which fields were auto-extracted
        const meta: Record<string, FieldMeta> = {};
        for (const [k, v] of Object.entries(fields)) {
          meta[k] = { extracted: v !== '', edited: false };
        }
        setFieldMeta(meta);

        setReviewPayslipId(payslipId);
        setFileName(updatedPayslip.file_name || fileName || 'Payslip');
        setCompletionState(null);
        setState('review');
        return true;
      }

      if (updatedPayslip.status !== 'completed') {
        // The function is synchronous: a successful HTTP response without a
        // terminal record state is not proof that the payslip was processed.
        showProcessingFailure(payslipId, 'processing_result_not_final');
        return false;
      }

      const anomalyCount = fnData?.anomalies_found || 0;
      toast({
        title: 'Payslip processed',
        description: anomalyCount > 0
          ? `We found ${anomalyCount} item${anomalyCount !== 1 ? 's' : ''} worth reviewing.`
          : 'No changes were flagged in this check. Review the extracted figures before confirming.',
      });
      setProgress(100);
      setCompletionState('already_saved');
      setState('success');
      onUploadComplete?.(payslipId);
      return true;
    } catch {
      showProcessingFailure(payslipId, 'edge_function_failed');
      return false;
    } finally {
      await invalidatePayslipQueries();
    }
  }, [fileName, invalidatePayslipQueries, onUploadComplete, showProcessingFailure, toast]);

  const uploadFile = useCallback(async (file: File) => {
    if (!user) return;

    if (!accessReady) {
      setErrorMsg(accessError
        ? 'We could not verify your upload access. Check your connection and try again.'
        : 'We are still checking your upload access. Please wait a moment and try again.');
      setState('error');
      return;
    }

    if (!canUpload) {
      setErrorMsg(isPremium
        ? `You've reached your ${uploadLimit} automatic-check limit for this calendar month. It resets at the start of the next calendar month.`
        : `You've used the ${uploadLimit} automatic checks included with Free. Upgrade to Plus for up to 6 automatic checks per calendar month.`);
      setState('error');
      return;
    }

    if (!PAYSLIP_ALLOWED_FILE_TYPES.includes(file.type as (typeof PAYSLIP_ALLOWED_FILE_TYPES)[number])) {
      setErrorMsg('Please upload a PDF or image file (PNG, JPG, WebP).');
      setState('error');
      return;
    }
    if (file.size < 1 || file.size > PAYSLIP_MAX_FILE_BYTES) {
      setErrorMsg('File must be under 10 MB.');
      setState('error');
      return;
    }

    setFileName(file.name);
    setErrorMsg('');
    setFailedPayslipId(null);
    setState('uploading');
    setProgress(10);

    try {
      const { data: issuedData, error: issueError } = await supabase.functions.invoke('start-payslip-upload', {
        body: { fileName: file.name, contentType: file.type },
      });
      const issuedUpload = issueError ? null : parseIssuedPayslipUpload(issuedData, user.id);
      if (!issuedUpload) {
        logError('upload_session_failed', 'Could not issue a scoped payslip upload');
        setErrorMsg('We couldn\'t prepare a secure upload. Please wait a moment and try again.');
        setState('error');
        return;
      }

      let storageError: unknown = null;
      try {
        const uploadResult = await supabase.storage
          .from('payslips')
          .uploadToSignedUrl(issuedUpload.path, issuedUpload.token, file, {
            cacheControl: '0',
            contentType: issuedUpload.contentType,
          });
        storageError = uploadResult.error;
      } catch {
        // Storage may have accepted the bytes before the network response was
        // lost. Fall through to the idempotent server-side settlement below.
        storageError = new Error('Storage upload response unavailable');
      }

      if (storageError) {
        // A network error can arrive after Storage accepted the bytes. The finish
        // endpoint is idempotent, so ask the server to settle the scoped session
        // before presenting a retry rather than issuing a second object key.
        let recoveredData: { payslipId?: unknown } | null = null;
        let recoveredError: unknown = null;
        try {
          const recovery = await supabase.functions.invoke('finish-payslip-upload', {
            body: { sessionId: issuedUpload.sessionId },
          });
          recoveredData = recovery.data as { payslipId?: unknown } | null;
          recoveredError = recovery.error;
        } catch {
          recoveredError = new Error('Upload settlement unavailable');
        }
        if (!recoveredError && typeof recoveredData?.payslipId === 'string') {
          setProgress(60);
          await processPayslip(recoveredData.payslipId);
          return;
        }
        logError('upload_failed', 'Scoped storage upload could not be confirmed');
        setErrorMsg('We couldn\'t confirm that upload. Its secure session will be cleared automatically; please try again shortly.');
        setState('error');
        return;
      }
      setProgress(60);

      const { data: finalisedData, error: finaliseError } = await supabase.functions.invoke('finish-payslip-upload', {
        body: { sessionId: issuedUpload.sessionId },
      });
      const payslipId = !finaliseError && typeof finalisedData?.payslipId === 'string'
        ? finalisedData.payslipId
        : null;
      if (!payslipId) {
        logError('upload_finalisation_failed', 'Could not create a server-owned payslip record');
        setErrorMsg('We couldn\'t save that payslip. Its secure session will be cleared automatically; please try again shortly.');
        setState('error');
        return;
      }

      // The server creates the row and binds its single quota reservation before
      // the existing processing flow can send the document to a provider.
      await processPayslip(payslipId);
    } catch {
      logError('upload_transport_failed', 'Scoped payslip upload could not be completed');
      setErrorMsg('We couldn\'t complete that upload. Please try again; we will not create another payslip unless a secure upload is confirmed.');
      setState('error');
    }
  }, [accessError, accessReady, canUpload, isPremium, processPayslip, uploadLimit, user]);

  const retryProcessing = useCallback(async () => {
    if (!failedPayslipId) {
      resetState();
      return;
    }

    await processPayslip(failedPayslipId);
  }, [failedPayslipId, processPayslip]);

  const openManualReview = useCallback(async () => {
    if (!failedPayslipId || !user) return;

    setState('opening_review');
    setErrorMsg('');

    try {
      const { error: manualReviewError } = await supabase.rpc('begin_manual_payslip_review', {
        p_payslip_id: failedPayslipId,
      });

      if (manualReviewError) throw manualReviewError;

      const [
        { data: payslip, error: payslipError },
        { data: profile },
      ] = await Promise.all([
        supabase
          .from('payslips')
          .select('status, country, file_name')
          .eq('id', failedPayslipId)
          .single(),
        supabase
          .from('profiles')
          .select('country')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (payslipError || !payslip || payslip.status !== 'needs_review') {
        throw new Error('Manual review could not be opened');
      }

      const fields: ReviewFields = {
        pay_date: '', employer_name: '', gross_pay: '', net_pay: '',
        tax_amount: '', ni_amount: '', prsi_amount: '', usc_amount: '',
        pension_amount: '', total_deductions: '',
      };
      const meta = Object.fromEntries(
        Object.keys(fields).map((key) => [key, { extracted: false, edited: false }]),
      ) as Record<string, FieldMeta>;

      setReviewCountry(payslip.country === 'Ireland' || profile?.country === 'Ireland' ? 'Ireland' : 'UK');
      setReviewFields(fields);
      setFieldMeta(meta);
      setReviewExtraction(emptyReviewExtractionDetails());
      setReviewPayslipId(failedPayslipId);
      setFileName(payslip.file_name || 'Payslip');
      setFailedPayslipId(null);
      setCompletionState(null);
      setState('review');
      await invalidatePayslipQueries();
    } catch {
      logError('manual_review_open_failed', 'Could not open a manual payslip review');
      setErrorMsg('We couldn\'t open a manual review for this payslip. Please try again or upload another copy.');
      setState('error');
      toast({
        title: 'Manual review could not be opened',
        description: 'Your file is still in the vault. Please try again.',
        variant: 'destructive',
      });
    }
  }, [failedPayslipId, invalidatePayslipQueries, toast, user]);

  const handleReviewSave = async () => {
    if (!reviewPayslipId) return;
    const grossPay = parseReviewAmount(reviewFields.gross_pay);
    const netPay = parseReviewAmount(reviewFields.net_pay);
    const validationErrors: Partial<Record<RequiredReviewField, string>> = {};
    if (!reviewFields.pay_date) {
      validationErrors.pay_date = 'Enter the pay date shown on your payslip.';
    }
    if (grossPay === null || grossPay <= 0) {
      validationErrors.gross_pay = 'Enter a gross pay amount greater than zero.';
    }
    if (netPay === null || netPay <= 0) {
      validationErrors.net_pay = 'Enter a net pay amount greater than zero.';
    }
    const firstInvalidField = (['pay_date', 'gross_pay', 'net_pay'] as const)
      .find((field) => validationErrors[field]);
    if (firstInvalidField) {
      setReviewErrors(validationErrors);
      requestAnimationFrame(() => reviewInputRefs.current[firstInvalidField]?.focus());
      return;
    }

    setReviewErrors({});

    setReviewSaving(true);
    try {
      const { error: confirmationError } = await supabase.rpc('confirm_payslip_review', {
        p_payslip_id: reviewPayslipId,
        p_country: reviewCountry,
        p_pay_date: reviewFields.pay_date,
        p_gross_pay: grossPay,
        p_net_pay: netPay,
        p_tax_amount: parseReviewAmount(reviewFields.tax_amount),
        p_national_insurance_amount: parseReviewAmount(reviewFields.ni_amount),
        p_prsi_amount: parseReviewAmount(reviewFields.prsi_amount),
        p_usc_amount: parseReviewAmount(reviewFields.usc_amount),
        p_pension_amount: parseReviewAmount(reviewFields.pension_amount),
        p_total_deductions: parseReviewAmount(reviewFields.total_deductions),
      });

      if (confirmationError) {
        toast({ title: 'Save failed', description: confirmationError.message, variant: 'destructive' });
        return;
      }

      // Employer names are profile data, not extraction state. Keep that optional
      // edit separate from the atomic confirmation path.
      if (reviewFields.employer_name && fieldMeta.employer_name?.edited) {
        const { data: payslipData } = await supabase
          .from('payslips')
          .select('employer_id')
          .eq('id', reviewPayslipId)
          .single();

        if (payslipData?.employer_id) {
          await supabase
            .from('employers')
            .update({ name: reviewFields.employer_name })
            .eq('id', payslipData.employer_id);
        }
      }

      toast({ title: 'Payslip confirmed', description: `Saved with pay date ${formatDate(reviewFields.pay_date)}.` });
      queryClient.invalidateQueries({ queryKey: ['payslips'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      setProgress(100);
      setCompletionState('confirmed');
      setState('success');
      onUploadComplete?.(reviewPayslipId);
    } catch {
      toast({ title: 'Save failed', description: 'We could not confirm this payslip. Please try again.', variant: 'destructive' });
    } finally {
      setReviewSaving(false);
    }
  };

  const handleReviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleReviewSave();
  };

  const parseReviewAmount = (value: string): number | null => {
    const normalized = value.trim().replace(/,/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  // Determine which monetary fields to show based on country
  const isIreland = reviewCountry === 'Ireland';
  const reviewLineItems = reviewExtraction.extraction_line_items ?? [];
  const reviewFieldEvidence = reviewExtraction.extraction_field_evidence ?? [];
  const reviewYearToDate = reviewExtraction.year_to_date;
  const reviewExtractionContextEntries = reviewExtraction.extraction_context
    ? EXTRACTION_CONTEXT_FIELDS.flatMap(({ key, label }) => {
        const value = reviewExtraction.extraction_context?.[key];
        return value ? [{ key, label, value: formatExtractionContextValue(key, value) }] : [];
      })
    : [];
  const reviewCurrency = reviewExtraction.currency ?? (isIreland ? 'EUR' : 'GBP');

  const renderFieldStatus = (key: string) => {
    const meta = fieldMeta[key];
    if (!meta) return null;
    if (meta.edited) return <Badge variant="outline" className="pi-review-status pi-review-status--edited">Edited</Badge>;
    if (meta.extracted) return <Badge variant="outline" className="pi-review-status">Auto-filled</Badge>;
    return <Badge variant="outline" className="pi-review-status pi-review-status--missing">Add from original</Badge>;
  };

  return (
    <Card className={`pi-upload-card transition-all ${
      dragOver ? 'border-primary bg-primary/5' :
      state === 'error' ? 'border-destructive/50' :
      state === 'success' ? 'border-success/50' :
      state === 'review' ? 'pi-upload-card--review' :
      'border-border hover:border-muted-foreground/30'
    }`}>
      <CardContent
        className={`pi-upload-content ${state === 'review' ? 'pi-upload-content--review' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        {state === 'idle' && !accessReady && (
          <>
            <div className="pi-upload-icon">
              <FileText aria-hidden="true" />
            </div>
            <h3 className="pi-upload-title">
              {accessError ? 'We couldn’t verify upload access' : 'Checking upload access'}
            </h3>
            <p className="pi-upload-body">
              {accessError
                ? 'Check your connection, then try again before uploading a payslip.'
                : 'We’re confirming your account and included checks before you upload.'}
            </p>
            {accessError ? <Button className="pi-upload-action" onClick={() => void refetchAccess()}>Try again</Button> : null}
          </>
        )}

        {state === 'idle' && accessReady && !canUpload && (
          <>
            <div className="pi-upload-icon">
              <Sparkles aria-hidden="true" />
            </div>
            <h3 className="pi-upload-title">Automatic-check limit reached</h3>
            <p className="pi-upload-body">
              {isPremium
                ? `You've used all ${uploadLimit} included automatic checks this calendar month. It resets at the start of the next calendar month.`
                : `You've used the ${uploadLimit} automatic checks included with Free. Upgrade to Plus for up to 6 automatic checks per calendar month.`}
            </p>
            {!isPremium && (
              <Button asChild className="pi-upload-action">
                <Link to="/pricing">See Plus</Link>
              </Button>
            )}
            <p className="pi-upload-note">
              {isPremium
                ? 'Your paid allowance resets at the start of each calendar month (Ireland time).'
                : 'The Free automatic-check allowance does not renew.'}
            </p>
          </>
        )}

        {state === 'idle' && accessReady && canUpload && (
          <>
            <div className="pi-upload-icon">
              <Upload aria-hidden="true" />
            </div>
            <h3 className="pi-upload-title">Upload a payslip</h3>
            <p className="pi-upload-body">Choose a PDF or image. You’ll check every extracted figure before it is confirmed.</p>
            <Button className="pi-upload-action" onClick={() => fileInputRef.current?.click()}>Choose a file</Button>
            <p className="pi-upload-note">PDF, PNG, JPG up to 10 MB</p>
            <p className="pi-upload-note pi-upload-note--allowance">
              {uploadsRemaining} of {uploadLimit} automatic check{uploadLimit !== 1 ? 's' : ''} remaining {uploadQuotaScope === 'lifetime' ? 'on Free' : 'this calendar month'}
            </p>
            <div className="pi-upload-trust">
              <p>Only upload a payslip you are entitled to use. You’ll review the extracted figures before saving them.</p>
              <p>
                To create that review, your document may be processed by our configured service providers.{' '}
                <Link to="/privacy">How we handle your information</Link>
              </p>
            </div>
          </>
        )}

        {(state === 'uploading' || state === 'processing' || state === 'opening_review') && (
          <div className="flex w-full flex-col items-center text-center" role="status" aria-live="polite" aria-busy="true">
            <div className="pi-upload-icon animate-pulse">
              <FileText aria-hidden="true" />
            </div>
            <h3 className="pi-upload-title">
              {state === 'uploading' ? 'Uploading…' : state === 'processing' ? 'Extracting data…' : 'Opening your review…'}
            </h3>
            <p className="pi-upload-body">{state === 'opening_review' ? 'Loading the figures that are waiting for your confirmation.' : fileName}</p>
            {state !== 'opening_review' ? <Progress aria-label="Payslip upload progress" value={progress} className="pi-upload-progress" /> : null}
          </div>
        )}

        {state === 'review' && (
          <form className="pi-review-flow" noValidate onSubmit={handleReviewSubmit}>
            <div className="pi-review-header">
              <div className="pi-review-header-icon">
                <ClipboardCheck aria-hidden="true" />
              </div>
              <div>
                <p className="pi-eyebrow">Before you save</p>
                <h3>Check the details.</h3>
                <p>
                  We filled in what we could. Compare each figure with the original payslip and correct anything that looks off.
                </p>
              </div>
            </div>

            <div className="pi-review-source">
              <div className="pi-review-source-copy">
                <FileText aria-hidden="true" />
                <div>
                  <p>Original payslip</p>
                  <span>Private link that expires in one minute.</span>
                </div>
              </div>
              {originalPayslipState === 'ready' && originalPayslipUrl ? (
                <a
                  className="pi-review-source-link"
                  href={originalPayslipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  Open original payslip <ExternalLink aria-hidden="true" />
                </a>
              ) : originalPayslipState === 'loading' ? (
                <span className="pi-review-source-status">Preparing private link…</span>
              ) : (
                <span className="pi-review-source-status">Original file unavailable — you can still enter the figures manually.</span>
              )}
            </div>

            {(reviewLineItems.length > 0 || reviewYearToDate || reviewFieldEvidence.length > 0 || reviewExtractionContextEntries.length > 0) && (
              <section className="pi-review-extraction" aria-labelledby="review-extraction-heading">
                <div className="pi-review-extraction-header">
                  <div>
                    <p className="pi-eyebrow">Transcription evidence</p>
                    <h4 id="review-extraction-heading">What we found beyond the headline totals</h4>
                  </div>
                  {reviewExtraction.extraction_confidence && (
                    <Badge variant="outline" className="pi-review-status">{reviewExtraction.extraction_confidence} confidence</Badge>
                  )}
                </div>
                <p className="pi-review-extraction-note">
                  These rows and snippets are AI-transcribed from the original. Use the private original above to verify them; they are not a payroll verdict.
                </p>

                {reviewLineItems.length > 0 && (
                  <div className="pi-review-extraction-list" aria-label="Extracted payslip line items">
                    {reviewLineItems.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="pi-review-extraction-item">
                        <div>
                          <strong>{item.label}</strong>
                          <span>{item.kind === 'employer_contribution' ? 'Employer contribution' : item.kind} · {item.confidence} confidence</span>
                          {item.evidence && <small>“{item.evidence}”</small>}
                        </div>
                        <b>{item.amount == null ? '—' : formatReviewMoney(item.amount, reviewCurrency)}</b>
                      </div>
                    ))}
                  </div>
                )}

                {reviewYearToDate && (
                  <div className="pi-review-extraction-ytd" aria-label="Extracted year-to-date figures">
                    {[
                      ['Gross YTD', reviewYearToDate.gross_pay],
                      ['Tax YTD', reviewYearToDate.tax],
                      ['NI / PRSI YTD', reviewYearToDate.ni],
                      ['Pension YTD', reviewYearToDate.pension],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <span>{label}</span>
                        <strong>{typeof value === 'number' ? formatReviewMoney(value, reviewCurrency) : '—'}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {reviewExtractionContextEntries.length > 0 && (
                  <div className="pi-review-extraction-context" aria-label="Extracted payroll context">
                    <p>Payroll context printed on the payslip</p>
                    <span>Useful labels to check against the original, not a payroll verdict.</span>
                    <div>
                      {reviewExtractionContextEntries.map((item) => (
                        <div key={item.key}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reviewFieldEvidence.length > 0 && (
                  <details className="pi-review-extraction-evidence">
                    <summary>Show headline source snippets ({reviewFieldEvidence.length})</summary>
                    <div>
                      {reviewFieldEvidence.map((item, index) => (
                        <p key={`${item.field}-${index}`}><strong>{item.field.replace(/_/g, ' ')}</strong>{item.evidence ? ` — “${item.evidence}”` : ''}</p>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            )}

            <div className="pi-review-section">
              <div className="pi-review-section-heading">
                <p>Pay period</p>
                <span>Required fields have a star</span>
              </div>

              <div className="pi-review-row">
                <div className="flex items-center justify-between">
                  <Label htmlFor="r-date">Pay date <span className="text-destructive">*</span></Label>
                  {renderFieldStatus('pay_date')}
                </div>
                <Input
                  ref={(node) => { reviewInputRefs.current.pay_date = node; }}
                  className="pi-review-input"
                  id="r-date"
                  type="date"
                  value={reviewFields.pay_date}
                  onChange={(e) => updateField('pay_date', e.target.value)}
                  required
                  aria-invalid={Boolean(reviewErrors.pay_date)}
                  aria-describedby={reviewErrors.pay_date ? 'r-date-error' : undefined}
                />
                {reviewErrors.pay_date && <p id="r-date-error" className="mt-1 text-xs text-destructive" role="alert">{reviewErrors.pay_date}</p>}
              </div>
              <div className="pi-review-row">
                <div className="flex items-center justify-between">
                  <Label htmlFor="r-employer">Employer</Label>
                  {renderFieldStatus('employer_name')}
                </div>
                <Input className="pi-review-input" id="r-employer" value={reviewFields.employer_name} onChange={(e) => updateField('employer_name', e.target.value)} placeholder="e.g. Acme Ltd" />
              </div>
            </div>

            <div className="pi-review-section">
              <div className="pi-review-section-heading">
                <p id="review-country-label">Payslip country</p>
                <span>Correct this if the document was classified incorrectly.</span>
              </div>
              <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="review-country-label">
                <button
                  type="button"
                  aria-pressed={reviewCountry === 'UK'}
                  onClick={() => changeReviewCountry('UK')}
                  className={`min-h-11 rounded-md border px-3 text-sm font-medium transition-colors ${
                    reviewCountry === 'UK' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  United Kingdom
                </button>
                <button
                  type="button"
                  aria-pressed={reviewCountry === 'Ireland'}
                  onClick={() => changeReviewCountry('Ireland')}
                  className={`min-h-11 rounded-md border px-3 text-sm font-medium transition-colors ${
                    reviewCountry === 'Ireland' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  Ireland
                </button>
              </div>
            </div>

            <div className="pi-review-section">
              <div className="pi-review-section-heading">
                <p>Pay figures</p>
                <span>You can leave a figure blank if it is not on your payslip.</span>
              </div>

              <div className="pi-review-grid">
                <div className="pi-review-row">
                  <div className="flex items-center justify-between gap-1">
                    <Label htmlFor="r-gross" className="text-xs">Gross pay <span className="text-destructive">*</span></Label>
                    {renderFieldStatus('gross_pay')}
                  </div>
                  <Input
                    ref={(node) => { reviewInputRefs.current.gross_pay = node; }}
                    className="pi-review-input"
                    id="r-gross"
                    type="number"
                    min="0"
                    step="0.01"
                    value={reviewFields.gross_pay}
                    onChange={(e) => updateField('gross_pay', e.target.value)}
                    required
                    aria-invalid={Boolean(reviewErrors.gross_pay)}
                    aria-describedby={reviewErrors.gross_pay ? 'r-gross-error' : undefined}
                  />
                  {reviewErrors.gross_pay && <p id="r-gross-error" className="mt-1 text-xs text-destructive" role="alert">{reviewErrors.gross_pay}</p>}
                </div>
                <div className="pi-review-row">
                  <div className="flex items-center justify-between gap-1">
                    <Label htmlFor="r-net" className="text-xs">Net pay <span className="text-destructive">*</span></Label>
                    {renderFieldStatus('net_pay')}
                  </div>
                  <Input
                    ref={(node) => { reviewInputRefs.current.net_pay = node; }}
                    className="pi-review-input"
                    id="r-net"
                    type="number"
                    min="0"
                    step="0.01"
                    value={reviewFields.net_pay}
                    onChange={(e) => updateField('net_pay', e.target.value)}
                    required
                    aria-invalid={Boolean(reviewErrors.net_pay)}
                    aria-describedby={reviewErrors.net_pay ? 'r-net-error' : undefined}
                  />
                  {reviewErrors.net_pay && <p id="r-net-error" className="mt-1 text-xs text-destructive" role="alert">{reviewErrors.net_pay}</p>}
                </div>
              </div>

              <div className="pi-review-grid">
                <div className="pi-review-row">
                  <div className="flex items-center justify-between gap-1">
                    <Label htmlFor="r-tax" className="text-xs">Tax</Label>
                    {renderFieldStatus('tax_amount')}
                  </div>
                  <Input className="pi-review-input" id="r-tax" type="number" min="0" step="0.01" value={reviewFields.tax_amount} onChange={(e) => updateField('tax_amount', e.target.value)} />
                </div>

                {!isIreland && (
                  <div className="pi-review-row">
                    <div className="flex items-center justify-between gap-1">
                      <Label htmlFor="r-ni" className="text-xs">National Insurance</Label>
                      {renderFieldStatus('ni_amount')}
                    </div>
                    <Input className="pi-review-input" id="r-ni" type="number" min="0" step="0.01" value={reviewFields.ni_amount} onChange={(e) => updateField('ni_amount', e.target.value)} />
                  </div>
                )}

                {isIreland && (
                  <div className="pi-review-row">
                    <div className="flex items-center justify-between gap-1">
                      <Label htmlFor="r-prsi" className="text-xs">PRSI</Label>
                      {renderFieldStatus('prsi_amount')}
                    </div>
                    <Input className="pi-review-input" id="r-prsi" type="number" min="0" step="0.01" value={reviewFields.prsi_amount} onChange={(e) => updateField('prsi_amount', e.target.value)} />
                  </div>
                )}
              </div>

              {isIreland && (
                <div className="pi-review-grid">
                  <div className="pi-review-row">
                    <div className="flex items-center justify-between gap-1">
                      <Label htmlFor="r-usc" className="text-xs">USC</Label>
                      {renderFieldStatus('usc_amount')}
                    </div>
                    <Input className="pi-review-input" id="r-usc" type="number" min="0" step="0.01" value={reviewFields.usc_amount} onChange={(e) => updateField('usc_amount', e.target.value)} />
                  </div>
                  <div className="pi-review-row">
                    <div className="flex items-center justify-between gap-1">
                      <Label htmlFor="r-pension" className="text-xs">Pension</Label>
                      {renderFieldStatus('pension_amount')}
                    </div>
                    <Input className="pi-review-input" id="r-pension" type="number" min="0" step="0.01" value={reviewFields.pension_amount} onChange={(e) => updateField('pension_amount', e.target.value)} />
                  </div>
                </div>
              )}

              {!isIreland && (
                <div className="pi-review-grid">
                  <div className="pi-review-row">
                    <div className="flex items-center justify-between gap-1">
                      <Label htmlFor="r-pension" className="text-xs">Pension</Label>
                      {renderFieldStatus('pension_amount')}
                    </div>
                    <Input className="pi-review-input" id="r-pension" type="number" min="0" step="0.01" value={reviewFields.pension_amount} onChange={(e) => updateField('pension_amount', e.target.value)} />
                  </div>
                  <div className="pi-review-row">
                    <div className="flex items-center justify-between gap-1">
                      <Label htmlFor="r-deductions" className="text-xs">Total deductions</Label>
                      {renderFieldStatus('total_deductions')}
                    </div>
                    <Input className="pi-review-input" id="r-deductions" type="number" min="0" step="0.01" value={reviewFields.total_deductions} onChange={(e) => updateField('total_deductions', e.target.value)} />
                  </div>
                </div>
              )}

              {isIreland && (
                <div className="pi-review-row">
                  <div className="flex items-center justify-between gap-1">
                    <Label htmlFor="r-deductions" className="text-xs">Total deductions</Label>
                    {renderFieldStatus('total_deductions')}
                  </div>
                  <Input className="pi-review-input" id="r-deductions" type="number" min="0" step="0.01" value={reviewFields.total_deductions} onChange={(e) => updateField('total_deductions', e.target.value)} />
                </div>
              )}
            </div>

            <p className="pi-review-disclaimer">
              This review helps you spot details worth checking. It does not confirm that your payslip is correct.
            </p>

            <div className="pi-review-actions">
              <Button type="submit" className="pi-review-confirm" disabled={reviewSaving}>
                {reviewSaving ? 'Saving…' : 'Confirm my payslip'}
              </Button>
              <Button type="button" className="pi-review-cancel" variant="outline" onClick={resetState}>Cancel</Button>
            </div>
          </form>
        )}

        {state === 'success' && (
          <>
            <div className="pi-upload-icon pi-upload-icon--success">
              <CheckCircle aria-hidden="true" />
            </div>
            <h3 className="pi-upload-title">{completionState === 'confirmed' ? 'Payslip confirmed' : 'Payslip saved'}</h3>
            <p className="pi-upload-body">
              {completionState === 'confirmed'
                ? 'Your checked figures are now part of your pay history and ready to compare.'
                : 'This payslip is already in your history. You can review it again in the payslip list.'}
            </p>
            <div className="pi-upload-success-actions">
              <Button asChild className="pi-upload-action">
                <Link to="/dashboard">See my payday summary</Link>
              </Button>
              <Button variant="outline" className="pi-upload-action pi-upload-action--quiet" onClick={resetState}>Upload another</Button>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="pi-upload-icon pi-upload-icon--error">
              <AlertCircle aria-hidden="true" />
            </div>
            <h3 ref={errorHeadingRef} tabIndex={-1} className="pi-upload-title">{failedPayslipId ? 'Payslip needs another step' : 'Upload failed'}</h3>
            <p className="pi-upload-body pi-upload-body--error" role="alert">{errorMsg}</p>
            <div className="pi-upload-error-actions">
              {failedPayslipId ? (
                <Button className="pi-upload-action" onClick={retryProcessing}>Retry processing</Button>
              ) : null}
              {failedPayslipId ? (
                <Button className="pi-upload-action pi-upload-action--quiet" variant="outline" onClick={() => void openManualReview()}>
                  Enter figures manually
                </Button>
              ) : null}
              <Button className={failedPayslipId ? 'pi-upload-action pi-upload-action--quiet' : 'pi-upload-action'} variant={failedPayslipId ? 'outline' : 'default'} onClick={resetState}>
                {failedPayslipId ? 'Upload another' : 'Try again'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PayslipUpload;
