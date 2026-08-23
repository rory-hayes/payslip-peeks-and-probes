import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScrollToTop from './ScrollToTop';

describe('ScrollToTop', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a new route to the top of the page', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
        <Link to="/dashboard">Open dashboard</Link>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Open dashboard' }));

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0));
  });

  it('does not override an in-page anchor navigation', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={['/#features']}>
        <ScrollToTop />
      </MemoryRouter>,
    );

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls and focuses a direct campaign hash target after the route renders', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const scrollIntoView = vi.fn();

    render(
      <MemoryRouter initialEntries={['/#pricing']}>
        <ScrollToTop />
        <section id="pricing" tabIndex={-1} ref={(node) => {
          if (node) node.scrollIntoView = scrollIntoView;
        }}>
          Pricing
        </section>
      </MemoryRouter>,
    );

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' }));
    expect(screen.getByText('Pricing')).toHaveFocus();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
