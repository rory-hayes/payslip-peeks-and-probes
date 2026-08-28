import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AuthExperienceShell } from '@/components/AuthExperienceShell';
import { CheckoutPlanSummary } from '@/components/CheckoutPlanSummary';
import {
  checkoutPathForPrice,
  checkoutReturnPathForSession,
  getCheckoutPriceId,
  getCheckoutReturnSessionId,
  signUpPathForCheckout,
} from '@/lib/checkout-price';
import { isGoogleOAuthEnabled } from '@/lib/oauth-config';
import { applySeo } from '@/lib/seo';

const SignIn = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const checkoutPriceId = getCheckoutPriceId(searchParams.get('checkout'));
  const checkoutReturnSessionId = getCheckoutReturnSessionId(searchParams.get('checkout_return'));
  const postSignInPath = checkoutReturnSessionId
    ? checkoutReturnPathForSession(checkoutReturnSessionId)
    : checkoutPriceId
      ? checkoutPathForPrice(checkoutPriceId)
      : '/dashboard';
  const signUpPath = checkoutPriceId ? signUpPathForCheckout(checkoutPriceId) : '/sign-up';
  const googleOAuthEnabled = isGoogleOAuthEnabled();

  useEffect(() => {
    applySeo({
      title: 'Sign in | Payslip Insights',
      description: 'Securely sign in to Payslip Insights.',
      canonicalPath: null,
      noIndex: true,
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
        return;
      }
      navigate(postSignInPath);
    } catch {
      toast({
        title: 'Sign in failed',
        description: 'We could not sign you in. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle(`${window.location.origin}${postSignInPath}`);

      if (result.error) {
        toast({ title: 'Google sign in failed', description: String(result.error), variant: 'destructive' });
        setGoogleLoading(false);
        return;
      }

      // Supabase transfers the browser to the configured provider. Its normal
      // callback hydration will restore the session on the return URL.
    } catch (err) {
      toast({ title: 'Google sign in failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  return (
    <AuthExperienceShell>
        <Card className="border-0 shadow-none">
          <CardHeader className="px-0 pt-0 text-left">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">Your private pay history</p>
            <h1 className="text-2xl font-semibold leading-none tracking-tight">Welcome back</h1>
            <CardDescription className="text-sm leading-6">Sign in to review your confirmed payslips and continue where you left off.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <CheckoutPlanSummary
              checkoutPriceId={checkoutPriceId}
              description="Sign in to continue to secure checkout. You will confirm the final total before you are charged."
            />
            {googleOAuthEnabled ? (
              <>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                >
                  {googleLoading ? 'Connecting…' : 'Continue with Google'}
                </Button>

                <div className="relative my-6">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">or</span>
                </div>
              </>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account? <Link to={signUpPath} className="text-primary hover:underline font-medium">Sign up</Link>
            </p>
          </CardContent>
        </Card>
    </AuthExperienceShell>
  );
};

export default SignIn;
