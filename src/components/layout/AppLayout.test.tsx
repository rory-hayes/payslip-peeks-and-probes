import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "./AppLayout";

const state = vi.hoisted(() => ({
  disableDemo: vi.fn(),
  isDemo: true,
  signOut: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signOut: state.signOut }),
}));

vi.mock("@/contexts/DemoContext", () => ({
  useDemo: () => ({ disableDemo: state.disableDemo, isDemo: state.isDemo }),
}));

vi.mock("@/components/VerifyEmailBanner", () => ({
  default: () => null,
}));

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

describe("AppLayout demo navigation", () => {
  beforeEach(() => {
    state.disableDemo.mockReset();
    state.signOut.mockReset();
    state.isDemo = true;
  });

  it("only offers the demo-safe dashboard and exits without a provider sign-out", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout><p>Dashboard content</p></AppLayout>
        <Location />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("link", { name: "Dashboard" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Payslip Vault" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Anomalies" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Exit demo" })[0]);

    expect(state.disableDemo).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });
});
