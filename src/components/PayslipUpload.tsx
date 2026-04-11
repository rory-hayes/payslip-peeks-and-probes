import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface PayslipUploadProps {
  onUploadComplete?: (payslipId: string) => void;
}

const PayslipUpload = ({ onUploadComplete }: PayslipUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const resetState = () => {
    setState('idle');
    setProgress(0);
    setFileName('');
    setErrorMsg('');
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!user) return;

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
    setState('uploading');
    setProgress(10);

    const filePath = `${user.id}/${Date.now()}_${file.name}`;

    // Upload to storage
    const { error: storageError } = await supabase.storage
      .from('payslips')
      .upload(filePath, file, { contentType: file.type });

    if (storageError) {
      setErrorMsg(storageError.message);
      setState('error');
      return;
    }

    setProgress(60);

    // Create payslip record
    const { data: payslip, error: dbError } = await supabase
      .from('payslips')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        status: 'processing',
      })
      .select('id')
      .single();

    if (dbError || !payslip) {
      setErrorMsg(dbError?.message || 'Failed to create payslip record.');
      setState('error');
      return;
    }

    setProgress(80);
    setState('processing');

    // Create placeholder extraction record
    await supabase.from('payslip_extractions').insert({
      payslip_id: payslip.id,
      extraction_status: 'pending',
    });

    setState('processing');

    // Trigger AI extraction via edge function
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('process-payslip', {
        body: { payslip_id: payslip.id },
      });

      if (fnError) {
        console.error('Processing error:', fnError);
        toast({ title: 'Upload complete', description: 'Your payslip was uploaded but processing encountered an issue. You can retry from the vault.' });
      } else {
        const anomalyCount = fnData?.anomalies_found || 0;
        toast({
          title: 'Payslip processed',
          description: anomalyCount > 0
            ? `We found ${anomalyCount} item${anomalyCount !== 1 ? 's' : ''} worth reviewing.`
            : 'Everything looks good — no issues found.',
        });
      }
    } catch (err) {
      console.error('Edge function call failed:', err);
      toast({ title: 'Upload complete', description: 'Processing will continue in the background.' });
    }

    setProgress(100);
    setState('success');
    onUploadComplete?.(payslip.id);
  }, [user, toast, onUploadComplete]);

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

  return (
    <Card className={`border-2 border-dashed transition-all ${
      dragOver ? 'border-primary bg-primary/5' :
      state === 'error' ? 'border-destructive/50' :
      state === 'success' ? 'border-success/50' :
      'border-border hover:border-muted-foreground/30'
    }`}>
      <CardContent
        className="flex flex-col items-center justify-center p-8 text-center"
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

        {state === 'idle' && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Upload a payslip</h3>
            <p className="mt-1 text-sm text-muted-foreground">Drag and drop a PDF or image, or click to browse</p>
            <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">PDF, PNG, JPG up to 10 MB</p>
          </>
        )}

        {(state === 'uploading' || state === 'processing') && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4 animate-pulse">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {state === 'uploading' ? 'Uploading…' : 'Processing…'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{fileName}</p>
            <Progress value={progress} className="mt-4 h-2 w-48" />
          </>
        )}

        {state === 'success' && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 mb-4">
              <CheckCircle className="h-7 w-7 text-success" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Upload complete</h3>
            <p className="mt-1 text-sm text-muted-foreground">{fileName}</p>
            <Button variant="outline" className="mt-4" onClick={resetState}>
              Upload another
            </Button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Upload failed</h3>
            <p className="mt-1 text-sm text-destructive">{errorMsg}</p>
            <Button variant="outline" className="mt-4" onClick={resetState}>
              Try again
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PayslipUpload;
