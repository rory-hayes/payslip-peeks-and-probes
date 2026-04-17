import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/use-profile';
import { useDemo } from '@/contexts/DemoContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { isDemo } = useDemo();

  // Demo mode only grants access to the dashboard. Any other protected
  // route while in demo mode bounces back to /dashboard so the user
  // doesn't end up on a blank screen or get kicked to /sign-in.
  if (isDemo) {
    if (location.pathname === '/dashboard') return <>{children}</>;
    return <Navigate to="/dashboard" replace />;
  }

  if (loading || (user && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  // Redirect to onboarding if not completed (unless already on /onboarding)
  if (profile && !profile.onboarding_complete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
