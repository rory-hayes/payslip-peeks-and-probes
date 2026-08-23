import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BrandLockup } from '@/components/BrandLockup';
import { applySeo } from '@/lib/seo';

type RecoveryState = 'checking' | 'ready' | 'invalid';

function isRecoveryLink(url: URL): { code: string | null; isRecovery: boolean } {
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const queryType = url.searchParams.get('type');
  const hashType = hashParams.get('type');
  const code = url.searchParams.get('code');

  return {
    code,
    // Supabase's implicit recovery flow uses a fragment. Its PKCE flow uses a
    // one-time code. Both need a real session before a password can change.
    isRecovery: hashType === 'recovery' || queryType === 'recovery' || Boolean(code),
  };
}

function resetErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('session') || message.includes('token') || message.includes('expired')) {
    return 'This reset link is no longer valid. Request a new one and try again.';
  }
  return 'We could not update your password. Please try again.';
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('checking');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    applySeo({
      title: 'Set a new password | Payslip Insights',
      description: 'Set a new password for your secure Payslip Insights account.',
      canonicalPath: null,
      noIndex: true,
    });
  }, []);

  useEffect(() => {
    let active = true;

    const establishRecoverySession = async () => {
      try {
        const url = new URL(window.location.href);
        const { code, isRecovery } = isRecoveryLink(url);
        if (!isRecovery) {
          if (active) setRecoveryState('invalid');
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (active) setRecoveryState('invalid');
            return;
          }
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (!session || error) {
          if (active) setRecoveryState('invalid');
          return;
        }

        // Do not leave a short-lived PKCE code or implicit recovery token in the
        // visible browser URL after Supabase has established the session.
        window.history.replaceState({}, document.title, url.pathname);
        if (active) setRecoveryState('ready');
      } catch {
        if (active) setRecoveryState('invalid');
      }
    };

    void establishRecoverySession();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setFormError('Choose a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Your passwords do not match.');
      return;
    }

    setFormError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormError(resetErrorMessage(error));
        return;
      }

      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
      navigate('/sign-in');
    } catch (error) {
      setFormError(resetErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (recoveryState === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4" aria-busy="true">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <p role="status" className="text-muted-foreground">Checking your reset link…</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (recoveryState === 'invalid') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold text-foreground">This reset link can&apos;t be used</h1>
            <p className="mt-2 text-sm text-muted-foreground">It may be invalid or expired. Request a new link to keep your account secure.</p>
            <Link to="/forgot-password" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">Request a new link</Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const passwordLongEnough = password.length === 0 || password.length >= 8;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <BrandLockup />
          </Link>
        </div>
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-semibold leading-none tracking-tight text-foreground">Set a new password</h1>
            <CardDescription>Choose a password with at least 8 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  autoComplete="new-password"
                  id="password"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  type="password"
                  value={password}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  aria-describedby={!passwordsMatch ? 'password-match-error' : undefined}
                  autoComplete="new-password"
                  id="confirm-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Type it again"
                  required
                  type="password"
                  value={confirmPassword}
                />
              </div>
              {!passwordLongEnough ? <p className="text-sm text-destructive">Choose at least 8 characters.</p> : null}
              {!passwordsMatch ? <p id="password-match-error" className="text-sm text-destructive">Your passwords do not match.</p> : null}
              {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
              <Button type="submit" className="w-full" disabled={loading || !passwordsMatch || !passwordLongEnough}>
                {loading ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ResetPassword;
