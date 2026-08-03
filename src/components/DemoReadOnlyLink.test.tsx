import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DemoReadOnlyLink from "./DemoReadOnlyLink";

describe("DemoReadOnlyLink", () => {
  it("keeps sample-data rows non-navigable in demo mode", () => {
    render(
      <MemoryRouter>
        <DemoReadOnlyLink isDemo to="/payslip/demo-1">Sample payslip</DemoReadOnlyLink>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Sample payslip" })).not.toBeInTheDocument();
    expect(screen.getByText("Sample payslip")).toHaveAttribute("data-demo-read-only", "true");
  });

  it("preserves navigation for a signed-in user", () => {
    render(
      <MemoryRouter>
        <DemoReadOnlyLink isDemo={false} to="/payslip/payslip-1">Saved payslip</DemoReadOnlyLink>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Saved payslip" })).toHaveAttribute("href", "/payslip/payslip-1");
  });
});
