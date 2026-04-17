import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY_PREFIX = 'paycheck.verify_email_dismissed.';

export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(true); // default true to avoid flash
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const key = DISMISS_KEY_PREFIX + user.id;
      setDismissed(localStorage.getItem(key) === '1');
    } catch {
      setDismissed(false);
    }
  }, [user]);

  if (!user) return null;
  if (user.email_confirmed_at) return null;
  // Google OAuth users typically have email auto-verified; fall back to provider check.
  const provider = (user.app_metadata as { provider?: string })?.provider;
  if (provider && provider !== 'email') return null;
  if (dismissed) return null;

  const handleResend = async () => {
    if (!user.email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: { emailRedirectTo: window.location.origin },
    });
    setResending(false);
    if (error) {
      toast({ title: 'Could not resend', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Verification email sent', description: `Check ${user.email} for the link.` });
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY_PREFIX + user.id, '1');
    } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="border-b border-warning/40 bg-warning/15 px-4 py-2.5 text-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-3 text-sm">
        <Mail className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <span className="flex-1 leading-snug">
          Please verify your email address ({user.email}) to secure your account.
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? 'Sending…' : 'Resend email'}
        </Button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
