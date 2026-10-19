import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound.jsx';

describe('NotFound', () => {
  it('says the page is missing and points to Tea, Coffee and home', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: "We couldn't find that page" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tea' })).toHaveAttribute('href', '/tea');
    expect(screen.getByRole('link', { name: 'Browse coffee' })).toHaveAttribute('href', '/coffee');
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });
});
