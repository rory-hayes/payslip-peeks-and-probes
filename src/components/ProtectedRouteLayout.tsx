import { useEffect } from 'react';
import { Outlet, useLocation } from "react-router";
import ProtectedRoute from "@/components/ProtectedRoute";
import { applySeo } from '@/lib/seo';

/**
 * A nested route layout keeps a single authenticated gate around all private
 * screens without importing its data hooks on public marketing routes.
 */
export default function ProtectedRouteLayout() {
  const location = useLocation();

  useEffect(() => {
    applySeo({
      title: 'Your account | Payslip Insights',
      description: 'Secure Payslip Insights account area.',
      canonicalPath: null,
      noIndex: true,
    });
  }, [location.pathname]);

  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}
