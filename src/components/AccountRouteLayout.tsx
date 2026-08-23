import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "react-router";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";

// This module is loaded only for account routes. Keeping the client stable at
// module scope preserves the current cache behaviour while someone moves
// between sign-in, onboarding, checkout and the signed-in app.
const queryClient = new QueryClient();

/**
 * Route layout for every page that needs an account session. It deliberately
 * owns the account-only dependencies so the public landing page does not pay
 * for Supabase or React Query before a visitor chooses an account journey.
 */
export default function AccountRouteLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Outlet />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
