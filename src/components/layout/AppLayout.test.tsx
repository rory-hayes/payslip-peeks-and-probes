import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
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

    expect(screen.getAllByRole("link", { name: "Home" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Pay check" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Things to check" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Me" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Exit demo" })[0]);

    expect(state.disableDemo).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });

  it("adds the payday plan to the signed-in navigation", () => {
    state.isDemo = false;

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout><p>Dashboard content</p></AppLayout>
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("link", { name: "Plan" }).some((link) => link.getAttribute("href") === "/plan")).toBe(true);
  });

  it('gives the mobile navigation dialog an accessible name', async () => {
    state.isDemo = false;

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout><p>Dashboard content</p></AppLayout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(await screen.findByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();
  });

  it("keeps a signed-in person in place when provider sign-out fails", async () => {
    state.isDemo = false;
    state.signOut.mockRejectedValue(new Error('network unavailable'));

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout><p>Dashboard content</p></AppLayout>
        <Location />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);

    await waitFor(() => expect(state.signOut).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
    expect(screen.getAllByRole('button', { name: 'Sign out' })[0]).toBeEnabled();
  });
});
