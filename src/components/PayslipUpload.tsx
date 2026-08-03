import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
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
import { Upload, FileText, CheckCircle, AlertCircle, ClipboardCheck, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/date-utils';
import { useUsage } from '@/hooks/use-usage';

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

interface PayslipUploadProps {
  onUploadComplete?: (payslipId: string) => void;
  resumeReviewId?: string | null;
}

const STORAGE_FILENAME_MAX_LENGTH = 96;
const SAFE_STORAGE_FILENAME_CHARACTERS = /[^A-Za-z0-9._-]+/g;
const STORAGE_FILENAME_SEPARATORS = /[\\/]+/g;

/**
 * Object keys are security boundaries in the private payslips bucket. Keep the
 * user-controlled filename to one safe path segment so it cannot introduce a
 * second directory (or a traversal-looking key) beneath the authenticated
 * user's prefix.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Pure storage-key boundary tested in isolation.
export const sanitizeStorageFilename = (fileName: string): string => {
  const lastPathSegment = fileName
    .normalize('NFKC')
    .replace(STORAGE_FILENAME_SEPARATORS, '/')
    .split('/')
    .pop() ?? '';

  const sanitized = lastPathSegment
    .replace(SAFE_STORAGE_FILENAME_CHARACTERS, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-')
    .replace(/-+\./g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, STORAGE_FILENAME_MAX_LENGTH);

  return sanitized || 'payslip';
};

// eslint-disable-next-line react-refresh/only-export-components -- Pure storage-key boundary tested in isolation.
export const createPayslipStoragePath = (userId: string, fileName: string): string => {
  // Supabase Auth user IDs are UUIDs. Enforcing that shape keeps this client
  // from ever constructing a nested or cross-user storage key.
  if (!/^[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12}$/.test(userId)) {
    throw new Error('Unable to create a secure storage path for this account.');
  }

  return `${userId}/${crypto.randomUUID()}-${sanitizeStorageFilename(fileName)}`;
};

const PayslipUpload = ({ onUploadComplete, resumeReviewId = null }: PayslipUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    accessError,
    accessReady,
    canUpload,
    uploadsRemaining,
    isPremium,
    refetchAccess,
  } = useUsage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [failedPayslipId, setFailedPayslipId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!resumeReviewId) return;

    let cancelled = false;

    const resumeReview = async () => {
      setState('opening_review');
      setErrorMsg('');
      setFailedPayslipId(null);

      const [
        { data: payslip, error: payslipError },
        { data: extraction, error: extractionError },
      ] = await Promise.all([
        supabase
          .from('payslips')
          .select('status, pay_date, country')
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
      setReviewPayslipId(resumeReviewId);
      setState('review');
    };

    void resumeReview();

    return () => {
      cancelled = true;
    };
  }, [resumeReviewId, toast]);

  const resetState = () => {
    setState('idle');
    setProgress(0);
    setFileName('');
    setErrorMsg('');
    setFailedPayslipId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setReviewPayslipId(null);
    setReviewFields({
      pay_date: '', employer_name: '', gross_pay: '', net_pay: '',
      tax_amount: '', ni_amount: '', prsi_amount: '', usc_amount: '',
      pension_amount: '', total_deductions: '',
    });
    setFieldMeta({});
  };

  const updateField = (key: keyof ReviewFields, value: string) => {
    setReviewFields(prev => ({ ...prev, [key]: value }));
    setFieldMeta(prev => ({ ...prev, [key]: { ...prev[key], edited: true } }));
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
    setErrorMsg('We couldn\'t complete the payslip check. Your file is saved in the vault, so you can retry processing or upload a different copy.');
    setState('error');
    toast({
      title: 'Payslip needs another try',
      description: 'We couldn\'t complete the check. You can retry it now.',
      variant: 'destructive',
    });
  }, [toast]);

  const processPayslip = useCallback(async (payslipId: string): Promise<boolean> => {
    setFailedPayslipId(null);
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
        supabase.from('payslips').select('status, pay_date, pay_period_start, pay_period_end, country').eq('id', payslipId).single(),
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

        // Track which fields were auto-extracted
        const meta: Record<string, FieldMeta> = {};
        for (const [k, v] of Object.entries(fields)) {
          meta[k] = { extracted: v !== '', edited: false };
        }
        setFieldMeta(meta);

        setReviewPayslipId(payslipId);
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
      setState('success');
      return true;
    } catch {
      showProcessingFailure(payslipId, 'edge_function_failed');
      return false;
    } finally {
      await invalidatePayslipQueries();
    }
  }, [invalidatePayslipQueries, showProcessingFailure, toast]);

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
      setErrorMsg('You\'ve reached your free automatic-check limit this Dublin calendar month. See Plus options for more checks.');
      setState('error');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMsg('Please upload a PDF or image file (PNG, JPG, WebP).');
      setState('error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File must be under 10 MB.');
      setState('error');
      return;
    }

    setFileName(file.name);
    setErrorMsg('');
    setFailedPayslipId(null);
    setState('uploading');
    setProgress(10);

    let filePath: string;
    try {
      filePath = createPayslipStoragePath(user.id, file.name);
    } catch {
      setErrorMsg('We couldn\'t prepare a secure upload for this account. Please sign out and back in, then try again.');
      setState('error');
      return;
    }

    const { error: storageError } = await supabase.storage
      .from('payslips')
      .upload(filePath, file, { contentType: file.type });

    if (storageError) {
      console.error('Storage upload failed');
      logError('upload_failed', 'Storage upload failed');
      setErrorMsg('Upload failed. Please check your file and try again.');
      setState('error');
      return;
    }
    setProgress(60);

    const { data: payslip, error: dbError } = await supabase
      .from('payslips')
      .insert({ user_id: user.id, file_name: file.name, file_path: filePath, status: 'processing' })
      .select('id')
      .single();

    if (dbError || !payslip) {
      console.error('Payslip record could not be created');
      try {
        const { error: cleanupError } = await supabase.storage.from('payslips').remove([filePath]);
        if (cleanupError) {
          logError('upload_cleanup_failed', 'Could not remove an orphaned payslip upload');
        }
      } catch {
        logError('upload_cleanup_failed', 'Could not remove an orphaned payslip upload');
      }
      setErrorMsg('Something went wrong saving your payslip. Please try again.');
      setState('error');
      return;
    }

    // The server creates the extraction record inside its atomic processing
    // claim, so a browser retry cannot leave duplicate pending records.
    const processed = await processPayslip(payslip.id);
    if (processed) onUploadComplete?.(payslip.id);
  }, [accessError, accessReady, canUpload, onUploadComplete, processPayslip, user]);

  const retryProcessing = useCallback(async () => {
    if (!failedPayslipId) {
      resetState();
      return;
    }

    const processed = await processPayslip(failedPayslipId);
    if (processed) onUploadComplete?.(failedPayslipId);
  }, [failedPayslipId, onUploadComplete, processPayslip]);

  const handleReviewSave = async () => {
    if (!reviewPayslipId) return;
    const grossPay = parseReviewAmount(reviewFields.gross_pay);
    const netPay = parseReviewAmount(reviewFields.net_pay);
    if (!reviewFields.pay_date) {
      toast({ title: 'Pay date required', description: 'Please enter the pay date from your payslip.', variant: 'destructive' });
      return;
    }
    if (grossPay === null || grossPay <= 0) {
      toast({ title: 'Gross pay required', description: 'Please enter a valid gross pay amount.', variant: 'destructive' });
      return;
    }
    if (netPay === null || netPay <= 0) {
      toast({ title: 'Net pay required', description: 'Please enter a valid net pay amount.', variant: 'destructive' });
      return;
    }

    setReviewSaving(true);
    try {
      const { error: confirmationError } = await supabase.rpc('confirm_payslip_review', {
        p_payslip_id: reviewPayslipId,
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
      setState('success');
    } catch {
      toast({ title: 'Save failed', description: 'We could not confirm this payslip. Please try again.', variant: 'destructive' });
    } finally {
      setReviewSaving(false);
    }
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
                : 'We’re confirming your account and monthly allowance before you upload.'}
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
              You've used all 3 free automatic checks this Dublin calendar month. See Plus options for more checks.
            </p>
            <Link to="/pricing">
              <Button className="pi-upload-action">See Plus</Button>
            </Link>
            <p className="pi-upload-note">Limits reset at the start of each Dublin calendar month</p>
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
            {!isPremium && (
              <p className="pi-upload-note pi-upload-note--allowance">
                {uploadsRemaining} automatic check{uploadsRemaining !== 1 ? 's' : ''} remaining this Dublin calendar month
              </p>
            )}
          </>
        )}

        {(state === 'uploading' || state === 'processing' || state === 'opening_review') && (
          <>
            <div className="pi-upload-icon animate-pulse">
              <FileText aria-hidden="true" />
            </div>
            <h3 className="pi-upload-title">
              {state === 'uploading' ? 'Uploading…' : state === 'processing' ? 'Extracting data…' : 'Opening your review…'}
            </h3>
            <p className="pi-upload-body">{state === 'opening_review' ? 'Loading the figures that are waiting for your confirmation.' : fileName}</p>
            {state !== 'opening_review' ? <Progress value={progress} className="pi-upload-progress" /> : null}
          </>
        )}

        {state === 'review' && (
          <div className="pi-review-flow">
            <div className="pi-review-header">
              <div className="pi-review-header-icon">
                <ClipboardCheck aria-hidden="true" />
              </div>
              <div>
                <p className="pi-eyebrow">Before you save</p>
                <h3>Check the details.</h3>
                <p>
                  We filled in what we could. Compare it with your original payslip and correct anything that looks off.
                </p>
              </div>
            </div>

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
                <Input className="pi-review-input" id="r-date" type="date" value={reviewFields.pay_date} onChange={(e) => updateField('pay_date', e.target.value)} />
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
                <p>Pay figures</p>
                <span>You can leave a figure blank if it is not on your payslip.</span>
              </div>

              <div className="pi-review-grid">
                <div className="pi-review-row">
                  <div className="flex items-center justify-between gap-1">
                    <Label htmlFor="r-gross" className="text-xs">Gross pay <span className="text-destructive">*</span></Label>
                    {renderFieldStatus('gross_pay')}
                  </div>
                  <Input className="pi-review-input" id="r-gross" type="number" min="0" step="0.01" value={reviewFields.gross_pay} onChange={(e) => updateField('gross_pay', e.target.value)} />
                </div>
                <div className="pi-review-row">
                  <div className="flex items-center justify-between gap-1">
                    <Label htmlFor="r-net" className="text-xs">Net pay <span className="text-destructive">*</span></Label>
                    {renderFieldStatus('net_pay')}
                  </div>
                  <Input className="pi-review-input" id="r-net" type="number" min="0" step="0.01" value={reviewFields.net_pay} onChange={(e) => updateField('net_pay', e.target.value)} />
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
              <Button className="pi-review-confirm" onClick={handleReviewSave} disabled={reviewSaving}>
                {reviewSaving ? 'Saving…' : 'Confirm my payslip'}
              </Button>
              <Button className="pi-review-cancel" variant="outline" onClick={resetState}>Cancel</Button>
            </div>
          </div>
        )}

        {state === 'success' && (
          <>
            <div className="pi-upload-icon pi-upload-icon--success">
              <CheckCircle aria-hidden="true" />
            </div>
            <h3 className="pi-upload-title">Upload complete</h3>
            <p className="pi-upload-body">{fileName}</p>
            <Button variant="outline" className="pi-upload-action pi-upload-action--quiet" onClick={resetState}>Upload another</Button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="pi-upload-icon pi-upload-icon--error">
              <AlertCircle aria-hidden="true" />
            </div>
            <h3 className="pi-upload-title">Upload failed</h3>
            <p className="pi-upload-body pi-upload-body--error">{errorMsg}</p>
            <div className="pi-upload-error-actions">
              {failedPayslipId ? (
                <Button className="pi-upload-action" onClick={retryProcessing}>Retry processing</Button>
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
