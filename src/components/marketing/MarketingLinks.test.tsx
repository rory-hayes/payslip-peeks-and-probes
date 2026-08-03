import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import MarketingFooter from "./MarketingFooter";
import MarketingNav from "./MarketingNav";

describe("marketing How it works links", () => {
  it("returns visitors to the landing-page section instead of an unregistered route", () => {
    render(
      <MemoryRouter>
        <MarketingNav />
        <MarketingFooter />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link", { name: "How it works" });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute("href", "/#how-it-works"));
  });
});
