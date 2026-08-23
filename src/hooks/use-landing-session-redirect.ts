import { useEffect } from "react";
import type { NavigateFunction } from "react-router";

function mayNeedSessionRestore() {
  try {
    // The app's Supabase client persists sessions with an `sb-…-auth-token`
    // key. A new visitor has no such key, so avoid even fetching the account
    // SDK on their public marketing visit. If browser storage is unavailable,
    // fall back to restoring: that preserves the authenticated redirect.
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && /^sb-[a-z0-9-]+-auth-token$/i.test(key)) return true;
    }
  } catch {
    return true;
  }

  // A provider callback can arrive without a persisted session yet. The
  // account SDK must still receive it before deciding whether to redirect.
  const search = new URLSearchParams(window.location.search);
  return search.has("code")
    || search.has("error")
    || /(?:^|[&#])(access_token|refresh_token|error)=/.test(window.location.hash);
}

/**
 * The landing page should still send an authenticated visitor back to their
 * private dashboard, but the Supabase client is not needed to render public
 * marketing content. Load that client after the first paint rather than
 * making it part of the landing entry bundle.
 */
export function useLandingSessionRedirect(navigate: NavigateFunction) {
  useEffect(() => {
    if (!mayNeedSessionRestore()) return undefined;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    const redirectToDashboard = (session: { user?: unknown } | null) => {
      if (active && session?.user) navigate("/dashboard", { replace: true });
    };

    void import("@/integrations/supabase/client")
      .then(({ supabase }) => {
        if (!active) return undefined;

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          redirectToDashboard(session);
        });
        unsubscribe = () => subscription.unsubscribe();

        return supabase.auth.getSession();
      })
      .then((result) => {
        if (result) redirectToDashboard(result.data.session);
      })
      .catch(() => {
        // A public page remains usable if restoring a previous session is
        // temporarily unavailable. The account route will retry its own auth
        // check when the visitor chooses to continue.
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [navigate]);
}
