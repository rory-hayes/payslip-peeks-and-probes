import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const state = vi.hoisted(() => ({
  auth: { loading: false, user: null as { id: string } | null },
  demo: { isDemo: true },
  profile: { data: null as { onboarding_complete: boolean } | null, isLoading: false },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => state.auth,
}));

vi.mock("@/contexts/DemoContext", () => ({
  useDemo: () => state.demo,
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => state.profile,
}));

const renderProtected = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/dashboard" element={<ProtectedRoute><div>Demo dashboard</div></ProtectedRoute>} />
      <Route path="/vault" element={<ProtectedRoute><div>Payslip vault</div></ProtectedRoute>} />
    </Routes>
  </MemoryRouter>,
);

describe("ProtectedRoute demo handling", () => {
  beforeEach(() => {
    state.auth = { loading: false, user: null };
    state.demo = { isDemo: true };
    state.profile = { data: null, isLoading: false };
  });

  it("keeps unauthenticated demo visitors on the dashboard", async () => {
    renderProtected("/vault");

    expect(await screen.findByText("Demo dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Payslip vault")).not.toBeInTheDocument();
  });

  it("does not let a stale demo flag interrupt a real user's route", () => {
    state.auth = { loading: false, user: { id: "user-1" } };
    state.profile = { data: { onboarding_complete: true }, isLoading: false };

    renderProtected("/vault");

    expect(screen.getByText("Payslip vault")).toBeInTheDocument();
  });
});
