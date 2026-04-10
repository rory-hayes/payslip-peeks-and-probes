import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/components/layout/AppLayout';
import { demoPayslips, demoIssueDrafts, demoAnomalies, formatDate } from '@/lib/demo-data';
import { ArrowLeft, Copy, Mail, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DraftQuery = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const slip = demoPayslips.find((s) => s.id === id);
  const existingDraft = demoIssueDrafts.find((d) => d.payslip_id === id);
  const anomalies = demoAnomalies.filter((a) => a.payslip_id === id);

  const defaultSubject = slip ? `Query about my ${formatDate(slip.pay_date)} payslip` : '';
  const defaultBody = slip
    ? `Dear Payroll Team,\n\nI'm writing regarding my payslip dated ${formatDate(slip.pay_date)}.\n\n${
        anomalies.length > 0
          ? `I noticed the following:\n${anomalies.map((a) => `• ${a.title}`).join('\n')}\n\nCould you please review these items and confirm whether the figures are correct?`
          : 'I have a question about my pay this period and would appreciate your help reviewing the details.'
      }\n\nI'd appreciate any clarification. Happy to discuss further if needed.\n\nKind regards`
    : '';

  const [subject, setSubject] = useState(existingDraft?.subject || defaultSubject);
  const [body, setBody] = useState(existingDraft?.body || defaultBody);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    toast({ title: 'Copied to clipboard', description: 'Paste this into your email client.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

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
            <p className="text-sm text-muted-foreground">For payslip dated {formatDate(slip.pay_date)}</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="resize-y" />
            </div>
            <p className="text-xs text-muted-foreground">
              You can edit this message before sending. We've drafted it based on the issues flagged on this payslip.
            </p>
          </CardContent>
        </Card>

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
          This draft is generated as a starting point. Review and personalise it before sending. PayCheck does not send emails on your behalf.
        </p>
      </div>
    </AppLayout>
  );
};

export default DraftQuery;
