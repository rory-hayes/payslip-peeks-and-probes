import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { onboardingPathForCheckout, type CheckoutPriceId } from '@/lib/checkout-price';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, checkoutPriceId?: CheckoutPriceId | null) => Promise<{
    error: Error | null;
    emailConfirmationRequired: boolean;
  }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (redirectTo: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up listener FIRST so we don't miss any auth events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setLoading(false);
    });

    // Then fetch the existing session. The listener above will also fire
    // INITIAL_SESSION, but calling this guarantees we hydrate even if the
    // listener races with a back/forward navigation re-mount.
    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!mounted) return;
        setSession(initialSession);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        // A transient provider failure must not strand the entire app behind
        // the auth loading screen. Treat it as signed out; a later auth event
        // can still hydrate a restored session.
        setSession(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    checkoutPriceId: CheckoutPriceId | null = null,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName },
        // A confirmed session belongs at the protected setup route, not the
        // marketing homepage. Supabase must allow this exact origin/route in
        // its redirect allow-list before the production release is enabled.
        emailRedirectTo: `${window.location.origin}${onboardingPathForCheckout(checkoutPriceId)}`,
      },
    });
    return {
      error: error as Error | null,
      // Supabase intentionally omits a session when confirm-email is enabled.
      // Surface that state instead of sending someone to a protected route that
      // immediately redirects them back to sign in.
      emailConfirmationRequired: !error && !data.session,
    };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async (redirectTo: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signUp, signIn, signInWithGoogle, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};
