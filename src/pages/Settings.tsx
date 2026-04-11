import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [country, setCountry] = useState<'UK' | 'Ireland'>('UK');
  const [annualSalary, setAnnualSalary] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [employer, setEmployer] = useState('');
  const [payrollEmail, setPayrollEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const currencySymbol = country === 'Ireland' ? '€' : '£';

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFirstName(data.first_name || '');
          setCountry((data.country as 'UK' | 'Ireland') || 'UK');
          setFrequency(data.pay_frequency || 'monthly');
          setEmployer(data.employer_name || '');
          setPayrollEmail(data.payroll_email || '');
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        country,
        pay_frequency: frequency,
        employer_name: employer,
        payroll_email: payrollEmail || null,
      })
      .eq('user_id', user.id);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved', description: 'Your profile has been updated.' });
    }
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

        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : 'Save changes'}
        </Button>

        <Separator />

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base text-destructive">Danger zone</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Sign out</p>
                <p className="text-xs text-muted-foreground">Sign out of your account on this device.</p>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
            </div>
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
