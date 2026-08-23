import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const state = vi.hoisted(() => ({
  auth: { loading: false, user: null as { id: string } | null },
  demo: { isDemo: true },
  profileError: false,
  profile: { data: null as { onboarding_complete: boolean } | null, isLoading: false },
  refetchProfile: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => state.auth,
}));

vi.mock("@/contexts/DemoContext", () => ({
  useDemo: () => state.demo,
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ ...state.profile, isError: state.profileError, refetch: state.refetchProfile }),
}));

const renderProtected = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/dashboard" element={<ProtectedRoute><div>Demo dashboard</div></ProtectedRoute>} />
      <Route path="/vault" element={<ProtectedRoute><div>Payslip vault</div></ProtectedRoute>} />
      <Route path="/checkout" element={<ProtectedRoute><div>Checkout</div></ProtectedRoute>} />
      <Route path="/checkout/return" element={<ProtectedRoute><div>Checkout return</div></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><div>Onboarding</div></ProtectedRoute>} />
      <Route path="/sign-in" element={<div>Sign in</div>} />
    </Routes>
    <CurrentLocation />
  </MemoryRouter>,
);

const CurrentLocation = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

describe("ProtectedRoute demo handling", () => {
  beforeEach(() => {
    state.auth = { loading: false, user: null };
    state.demo = { isDemo: true };
    state.profileError = false;
    state.profile = { data: null, isLoading: false };
    state.refetchProfile.mockReset();
  });

  it("keeps unauthenticated demo visitors on the dashboard", async () => {
    renderProtected("/vault");

    expect(await screen.findByText("Demo dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Payslip vault")).not.toBeInTheDocument();
  });

  it('announces account loading instead of rendering a silent spinner', () => {
    state.auth = { loading: true, user: null };
    state.demo = { isDemo: false };

    renderProtected('/dashboard');

    expect(screen.getByText('Loading your account…')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });

  it('does not bypass onboarding when the profile check fails', () => {
    state.auth = { loading: false, user: { id: 'user-1' } };
    state.demo = { isDemo: false };
    state.profileError = true;

    renderProtected('/dashboard');

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t verify your account setup.');
    expect(screen.queryByText('Demo dashboard')).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(state.refetchProfile).toHaveBeenCalledTimes(1);
  });

  it("does not let a stale demo flag interrupt a real user's route", () => {
    state.auth = { loading: false, user: { id: "user-1" } };
    state.profile = { data: { onboarding_complete: true }, isLoading: false };

    renderProtected("/vault");

    expect(screen.getByText("Payslip vault")).toBeInTheDocument();
  });

  it('preserves an allowlisted paid selection when onboarding is required', async () => {
    state.auth = { loading: false, user: { id: 'user-1' } };
    state.demo = { isDemo: false };
    state.profile = { data: { onboarding_complete: false }, isLoading: false };

    renderProtected('/checkout?price=plus_yearly');

    expect(await screen.findByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/onboarding?checkout=plus_yearly');
  });

  it('preserves a validated checkout return session when onboarding is required', async () => {
    state.auth = { loading: false, user: { id: 'user-1' } };
    state.demo = { isDemo: false };
    state.profile = { data: { onboarding_complete: false }, isLoading: false };

    renderProtected('/checkout/return?session_id=cs_test_checkoutreturn123');

    expect(await screen.findByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByTestId('location'))
      .toHaveTextContent('/onboarding?checkout_return=cs_test_checkoutreturn123');
  });

  it('preserves an allowlisted paid selection when authentication is required', async () => {
    state.auth = { loading: false, user: null };
    state.demo = { isDemo: false };

    renderProtected('/checkout?price=plus_yearly');

    expect(await screen.findByText('Sign in')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/sign-in?checkout=plus_yearly');
  });

  it('drops an unrecognised checkout value before redirecting to sign in', async () => {
    state.auth = { loading: false, user: null };
    state.demo = { isDemo: false };

    renderProtected('/checkout?price=anything-else');

    expect(await screen.findByText('Sign in')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/sign-in');
  });

  it('preserves a validated checkout return session when authentication is required', async () => {
    state.auth = { loading: false, user: null };
    state.demo = { isDemo: false };

    renderProtected('/checkout/return?session_id=cs_test_checkoutreturn123');

    expect(await screen.findByText('Sign in')).toBeInTheDocument();
    expect(screen.getByTestId('location'))
      .toHaveTextContent('/sign-in?checkout_return=cs_test_checkoutreturn123');
  });

  it('drops an invalid checkout return session before redirecting to sign in', async () => {
    state.auth = { loading: false, user: null };
    state.demo = { isDemo: false };

    renderProtected('/checkout/return?session_id=cs_test_checkoutreturn123%26next%3D%2Fdashboard');

    expect(await screen.findByText('Sign in')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/sign-in');
  });
});
