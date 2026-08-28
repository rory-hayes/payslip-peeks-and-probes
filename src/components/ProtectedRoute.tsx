import { Navigate, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/use-profile';
import { useDemo } from '@/contexts/DemoContext';
import {
  getCheckoutPriceId,
  getCheckoutReturnSessionId,
  onboardingPathForCheckout,
  onboardingPathForCheckoutReturn,
  signInPathForCheckout,
  signInPathForCheckoutReturn,
} from '@/lib/checkout-price';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { data: profile, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useProfile();
  const { isDemo } = useDemo();

  // Demo mode grants an unauthenticated visitor access only to the sample
  // dashboard and the official-source tax helper. Every account-owned route
  // remains behind authentication.
  // A real signed-in user takes precedence over a stale demo flag so sign-up
  // and onboarding cannot be redirected back into the demo.
  if (isDemo && !user) {
    if (location.pathname === '/dashboard' || location.pathname === '/tax-helper') return <>{children}</>;
    return <Navigate to="/dashboard" replace />;
  }

  if (loading || (user && profileLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background" aria-busy="true">
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
          <span>Loading your account…</span>
        </div>
      </main>
    );
  }

  if (user && profileError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="max-w-md text-center" role="alert">
          <h1 className="text-lg font-semibold text-foreground">We couldn’t verify your account setup.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account has not been changed. Check your connection and try again before continuing.
          </p>
          <Button className="mt-5 min-h-11" onClick={() => void refetchProfile()}>Try again</Button>
        </section>
      </main>
    );
  }

  if (!user) {
    // A direct or bookmarked checkout URL should not silently discard the
    // selected plan or the exact return session just because authentication is
    // needed first. Only fixed catalogue keys and Stripe-shaped checkout
    // session ids are allowed through; all other values fall back to normal
    // sign-in.
    const checkoutPriceId = location.pathname === '/checkout'
      ? getCheckoutPriceId(new URLSearchParams(location.search).get('price'))
      : null;
    const checkoutReturnSessionId = location.pathname === '/checkout/return'
      ? getCheckoutReturnSessionId(new URLSearchParams(location.search).get('session_id'))
      : null;
    const signInPath = checkoutReturnSessionId
      ? signInPathForCheckoutReturn(checkoutReturnSessionId)
      : signInPathForCheckout(checkoutPriceId);
    return <Navigate to={signInPath} replace />;
  }

  // Redirect to onboarding if not completed (unless already on /onboarding)
  if (profile && !profile.onboarding_complete && location.pathname !== '/onboarding') {
    const checkoutPriceId = location.pathname === '/checkout'
      ? getCheckoutPriceId(new URLSearchParams(location.search).get('price'))
      : null;
    const checkoutReturnSessionId = location.pathname === '/checkout/return'
      ? getCheckoutReturnSessionId(new URLSearchParams(location.search).get('session_id'))
      : null;
    const onboardingPath = checkoutReturnSessionId
      ? onboardingPathForCheckoutReturn(checkoutReturnSessionId)
      : onboardingPathForCheckout(checkoutPriceId);
    return <Navigate to={onboardingPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
