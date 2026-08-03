import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DemoExitOnArrival from "./DemoExitOnArrival";

const state = vi.hoisted(() => ({
  disableDemo: vi.fn(),
  isDemo: true,
}));

vi.mock("@/contexts/DemoContext", () => ({
  useDemo: () => state,
}));

describe("DemoExitOnArrival", () => {
  beforeEach(() => {
    state.disableDemo.mockReset();
    state.isDemo = true;
  });

  it("clears a demo session after its public destination mounts", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/sign-up", state: { exitDemo: true } }]}>
        <DemoExitOnArrival />
      </MemoryRouter>,
    );

    expect(state.disableDemo).toHaveBeenCalledOnce();
  });

  it("leaves a normal public arrival alone", () => {
    render(
      <MemoryRouter initialEntries={["/sign-up"]}>
        <DemoExitOnArrival />
      </MemoryRouter>,
    );

    expect(state.disableDemo).not.toHaveBeenCalled();
  });
});
