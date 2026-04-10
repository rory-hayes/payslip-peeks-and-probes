import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('Alex');
  const [country, setCountry] = useState<'UK' | 'Ireland'>('UK');
  const [frequency, setFrequency] = useState('monthly');
  const [employer, setEmployer] = useState('Acme Technologies Ltd');
  const [payrollEmail, setPayrollEmail] = useState('payroll@acme.com');

  const handleSave = () => {
    toast({ title: 'Settings saved', description: 'Your profile has been updated.' });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['UK', 'Ireland'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCountry(c)}
                      className={`rounded-lg border px-3 py-2 text-sm transition-all ${country === c ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground'}`}
                    >
                      {c === 'UK' ? '🇬🇧 UK' : '🇮🇪 Ireland'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pay frequency</Label>
              <div className="grid grid-cols-4 gap-2">
                {['weekly', 'fortnightly', 'monthly', 'other'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={`rounded-lg border px-2 py-2 text-xs capitalize transition-all ${frequency === f ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Employer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Employer name</Label>
              <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payroll / HR email</Label>
              <Input type="email" value={payrollEmail} onChange={(e) => setPayrollEmail(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave}>Save changes</Button>

        <Separator />

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base text-destructive">Danger zone</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Delete account</p>
                <p className="text-xs text-muted-foreground">Permanently delete your account and all stored payslips.</p>
              </div>
              <Button variant="destructive" size="sm">Delete account</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
