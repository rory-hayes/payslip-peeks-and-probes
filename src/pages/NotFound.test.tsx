import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import NotFound from '@/pages/NotFound';

describe('NotFound', () => {
  it('offers a calm in-app recovery without logging a false console error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={['/a-page-that-does-not-exist']}>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: "We can't find that page." })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
