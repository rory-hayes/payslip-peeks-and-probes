import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDemo } from '@/contexts/DemoContext';
import { useToast } from '@/hooks/use-toast';
import { analytics } from '@/lib/analytics';
import { AuthExperienceShell } from '@/components/AuthExperienceShell';
import { CheckoutPlanSummary } from '@/components/CheckoutPlanSummary';
import {
  getCheckoutPriceId,
  onboardingPathForCheckout,
  signInPathForCheckout,
} from '@/lib/checkout-price';
import { isGoogleOAuthEnabled } from '@/lib/oauth-config';
import { applySeo } from '@/lib/seo';
import { acceptsRealPayslips } from '@/lib/public-legal-details';

const SignUp = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signInWithGoogle } = useAuth();
  const { enableDemo } = useDemo();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const checkoutPriceId = acceptsRealPayslips ? getCheckoutPriceId(searchParams.get('checkout')) : null;
  const onboardingPath = onboardingPathForCheckout(checkoutPriceId);
  const signInPath = signInPathForCheckout(checkoutPriceId);
  const googleOAuthEnabled = isGoogleOAuthEnabled();

  useEffect(() => {
    applySeo({
      title: acceptsRealPayslips ? 'Create an account | Payslip Insights' : 'Product preview | Payslip Insights',
      description: acceptsRealPayslips
        ? 'Create a secure Payslip Insights account.'
        : 'Explore the Payslip Insights sample while secure real-payslip uploads complete release checks.',
      canonicalPath: null,
      noIndex: true,
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptsRealPayslips || !agreed) return;

    analytics.track('sign_up_started');
    setLoading(true);
    try {
      const result = await signUp(email.trim(), password, firstName.trim(), checkoutPriceId);
      if (result.error) {
        toast({ title: 'Sign up failed', description: result.error.message, variant: 'destructive' });
        return;
      }

      if (result.emailConfirmationRequired) {
        setConfirmationEmail(email.trim());
        return;
      }

      navigate(onboardingPath);
    } catch {
      toast({
        title: 'Sign up failed',
        description: 'We could not create your account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!acceptsRealPayslips || !agreed) return;

    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle(`${window.location.origin}${onboardingPath}`);

      if (result.error) {
        toast({ title: 'Google sign up failed', description: String(result.error), variant: 'destructive' });
        setGoogleLoading(false);
        return;
      }

      // Supabase transfers the browser to the configured provider. Its normal
      // callback hydration will restore the session on the return URL.
    } catch (err) {
      toast({ title: 'Google sign up failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  const handleOpenDemo = () => {
    analytics.track('demo_started');
    enableDemo();
    navigate('/dashboard');
  };

  if (!acceptsRealPayslips) {
    return (
      <AuthExperienceShell mode="preview">
        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pt-0 text-left">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">Early-access preview</p>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">Secure uploads are not open yet</h1>
            <CardDescription className="text-sm leading-6">
              We are completing the production controls required before accepting real payslips or new accounts. The full sample journey is ready to explore now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-0 pb-0">
            <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4" role="status">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">No personal details needed</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  The preview uses fictional sample data and includes the payday dashboard, comparison evidence and tax-year helper.
                </p>
              </div>
            </div>
            <Button className="min-h-11 w-full gap-2" onClick={handleOpenDemo}>
              Explore the sample <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button asChild className="min-h-11 w-full" variant="outline">
              <Link to={signInPath}>Sign in to an existing account</Link>
            </Button>
            <p className="text-center text-xs leading-5 text-muted-foreground">
              Questions about early access? <a className="font-medium text-primary hover:underline" href="mailto:support@payslipinsights.com">Contact support</a> without attaching a payslip.
            </p>
          </CardContent>
        </Card>
      </AuthExperienceShell>
    );
  }

  return (
    <AuthExperienceShell>
        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pt-0 text-left">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">Start free · no card required</p>
            <h1 className="text-2xl font-semibold leading-none tracking-tight">Create your account</h1>
            <CardDescription className="text-sm leading-6">Use your two included checks to understand your first payslip and compare the next one.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <CheckoutPlanSummary
              checkoutPriceId={checkoutPriceId}
              description="Create your account first, then confirm the final total in secure checkout before you are charged."
            />
            {googleOAuthEnabled ? (
              <>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleGoogleSignUp}
                  disabled={googleLoading || !agreed}
                  aria-describedby={!agreed ? 'terms-help' : undefined}
                >
                  {googleLoading ? 'Connecting…' : 'Continue with Google'}
                </Button>

                <div className="relative my-6">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">or</span>
                </div>
              </>
            ) : null}

            {confirmationEmail ? (
              <div aria-live="polite" className="space-y-5 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle className="h-8 w-8 text-success" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Check your inbox</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    We sent a confirmation link to <strong className="font-medium text-foreground">{confirmationEmail}</strong>. Open it and we’ll take you to set up your account.
                  </p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">If it does not arrive in a few minutes, check your junk folder or try again.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" onClick={() => setConfirmationEmail(null)}>Use another email</Button>
                  <Button asChild className="w-full">
                    <Link to={signInPath}>Go to sign in</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">First name</Label>
                    <Input autoComplete="given-name" id="name" placeholder="Your first name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input autoComplete="email" id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input autoComplete="new-password" id="password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox id="terms" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
                    <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                      I agree to the <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>. I understand Payslip Insights provides guidance, not formal tax or legal advice.
                    </label>
                  </div>
                  <p className="sr-only" id="terms-help">Agree to the Privacy Policy and Terms of Service before continuing.</p>
                  <Button aria-describedby={!agreed ? 'terms-help' : undefined} type="submit" className="w-full" disabled={loading || !agreed}>
                    {loading ? 'Creating account…' : 'Create free account'}
                  </Button>
                  {!checkoutPriceId ? <p className="text-center text-xs text-muted-foreground">No card required. Your first two automatic checks are included.</p> : null}
                </form>
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account? <Link to={signInPath} className="text-primary hover:underline font-medium">Sign in</Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
    </AuthExperienceShell>
  );
};

export default SignUp;
