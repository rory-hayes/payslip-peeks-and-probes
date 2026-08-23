import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { parseCheckoutReturnVerification } from "@/lib/checkout-return";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLLS = 8;

type CheckoutReturnViewStatus = 'loading' | 'success' | 'pending' | 'failed' | 'review';

const checkoutStatusAnnouncement: Record<CheckoutReturnViewStatus, string> = {
  loading: 'Processing payment. Please wait while we confirm it.',
  success: 'Payment confirmed. Your account has been upgraded.',
  pending: 'Your payment is still being confirmed. Do not submit another payment.',
  failed: 'We could not confirm this checkout return. Do not submit another payment.',
  review: 'This payment needs a safe manual check. Do not submit another payment.',
};

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CheckoutReturnViewStatus>('loading');
  const terminalHeadingRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (status !== 'loading') terminalHeadingRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (!sessionId) {
      setStatus('failed');
      return;
    }

    let isCancelled = false;
    let timer: number | undefined;
    let polls = 0;

    const retryOrShowPending = () => {
      polls += 1;
      if (polls >= MAX_POLLS) {
        // A delayed payment or webhook may settle after this small UI window.
        // Do not invite a second payment when the exact return session is
        // still unresolved.
        setStatus('pending');
        return;
      }

      timer = window.setTimeout(() => {
        void verifyCheckoutReturn();
      }, POLL_INTERVAL_MS);
    };

    const verifyCheckoutReturn = async () => {
      let response: { data: unknown; error: unknown };
      try {
        response = await supabase.functions.invoke("verify-checkout-return", {
          body: { sessionId },
        });
      } catch {
        if (!isCancelled) retryOrShowPending();
        return;
      }
      if (isCancelled) return;

      const { data, error } = response;

      if (error) {
        retryOrShowPending();
        return;
      }

      const verification = parseCheckoutReturnVerification(data);
      if (!verification) {
        // Do not infer success from a malformed response or from a broad
        // account-level subscription. That could describe a different
        // purchase than the session that returned the customer here.
        setStatus('failed');
        return;
      }

      if (verification.environment !== getStripeEnvironment()) {
        setStatus('review');
        return;
      }

      if (verification.status === 'confirmed') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['subscription'] }),
          queryClient.invalidateQueries({ queryKey: ['usage'] }),
        ]);
        if (!isCancelled) setStatus('success');
        return;
      }

      if (verification.status === 'review') {
        setStatus('review');
        return;
      }
      if (verification.status === 'invalid') {
        setStatus('failed');
        return;
      }

      retryOrShowPending();
    };

    void verifyCheckoutReturn();

    return () => {
      isCancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [sessionId, queryClient]);

  return (
    <main className="min-h-screen bg-card flex items-center justify-center p-4" aria-busy={status === 'loading'}>
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <span className="sr-only" role="status">{checkoutStatusAnnouncement[status]}</span>
          {status === 'loading' && (
            <>
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Processing payment…</h1>
              <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground" ref={terminalHeadingRef} tabIndex={-1}>Payment successful!</h1>
              <p className="text-muted-foreground">
                Your account has been upgraded. All premium features are now unlocked.
              </p>
              <Button asChild className="mt-4 w-full">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          )}
          {status === 'pending' && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground" ref={terminalHeadingRef} tabIndex={-1}>Your payment is being confirmed</h1>
              <p className="text-muted-foreground">
                Don&apos;t submit another payment. Your access will unlock as soon as Stripe confirms it.
              </p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          )}
          {status === 'failed' && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground" ref={terminalHeadingRef} tabIndex={-1}>Something went wrong</h1>
              <p className="text-muted-foreground">
                We couldn&apos;t confirm this checkout return. If you just paid, don&apos;t submit another payment; check your dashboard again shortly or contact support.
              </p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link to="/pricing">Back to Pricing</Link>
              </Button>
            </>
          )}
          {status === 'review' && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-amber-700" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground" ref={terminalHeadingRef} tabIndex={-1}>We need to check this payment</h1>
              <p className="text-muted-foreground">
                We&apos;re keeping this checkout separate from your account until we can verify it safely. Don&apos;t submit another payment.
              </p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link to="/settings">Go to Settings</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
