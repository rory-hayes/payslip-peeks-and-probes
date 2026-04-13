import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');

  useEffect(() => {
    if (!sessionId) {
      setStatus('failed');
      return;
    }

    // Invalidate subscription cache so it re-fetches after webhook processes
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    queryClient.invalidateQueries({ queryKey: ['usage'] });

    // Give webhook a moment to process, then mark as success
    // The webhook will populate the subscriptions table
    const timer = setTimeout(() => {
      setStatus('success');
      // Re-invalidate after a delay to catch webhook processing
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionId, queryClient]);

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
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
              <h1 className="text-2xl font-bold text-foreground">Payment successful!</h1>
              <p className="text-muted-foreground">
                Your account has been upgraded. All premium features are now unlocked.
              </p>
              <Link to="/dashboard">
                <Button className="w-full mt-4">Go to Dashboard</Button>
              </Link>
            </>
          )}
          {status === 'failed' && (
            <>
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
              <p className="text-muted-foreground">
                We couldn't confirm your payment. If you were charged, your access will activate shortly.
              </p>
              <Link to="/pricing">
                <Button variant="outline" className="w-full mt-4">Back to Pricing</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
