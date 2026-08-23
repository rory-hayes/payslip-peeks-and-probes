import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import MarketingFooter from "./MarketingFooter";
import MarketingNav from "./MarketingNav";
import { COOKIE_PREFERENCES_EVENT } from '@/lib/cookie-preferences';

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

  it('keeps landing, guide, and pricing routes available in the mobile menu', () => {
    render(
      <MemoryRouter>
        <MarketingNav />
      </MemoryRouter>,
    );

    const menu = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(menu);

    const navigation = screen.getByRole('group', { name: 'Mobile navigation' });
    expect(navigation).toHaveTextContent('How it works');
    expect(navigation).toHaveTextContent('Guides');
    expect(navigation).toHaveTextContent('Pricing');
    expect(navigation).toHaveTextContent('Sign in');

    fireEvent.click(screen.getAllByRole('link', { name: 'Guides' }).find((link) => link.closest('[role="group"]') === navigation)!);
    expect(screen.queryByRole('group', { name: 'Mobile navigation' })).not.toBeInTheDocument();
  });

  it('closes the mobile menu with Escape and returns focus to its trigger', () => {
    render(
      <MemoryRouter>
        <MarketingNav />
      </MemoryRouter>,
    );

    const menu = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(menu);
    expect(screen.getByRole('group', { name: 'Mobile navigation' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('group', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  it('lets a signed-out visitor reopen optional analytics choices from the footer', () => {
    let received = false;
    const onOpenPreferences = () => {
      received = true;
    };
    window.addEventListener(COOKIE_PREFERENCES_EVENT, onOpenPreferences);

    render(
      <MemoryRouter>
        <MarketingFooter />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Privacy choices' }));

    expect(received).toBe(true);
    window.removeEventListener(COOKIE_PREFERENCES_EVENT, onOpenPreferences);
  });
});
