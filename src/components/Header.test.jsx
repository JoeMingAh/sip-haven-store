import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header.jsx';
import { GUIDES } from '../data/guides.js';

// The mocked array is the one Header reads, so a test can add a guide to it.
vi.mock('../data/guides.js', () => ({ GUIDES: [] }));

afterEach(() => {
  GUIDES.length = 0;
});

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  it('lists the links in order, without Learn while there are no guides', () => {
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Tea', 'Coffee', 'Quiz', 'Our Story']);
    expect(screen.queryByRole('link', { name: 'Learn' })).not.toBeInTheDocument();
  });

  it('adds Learn between Quiz and Our Story once a guide exists', () => {
    GUIDES.push({ slug: 'steeping-basics' });
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Tea', 'Coffee', 'Quiz', 'Learn', 'Our Story']);
    expect(within(nav).getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/learn');
  });

  it('has a Cart link to /cart', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Cart' })).toHaveAttribute('href', '/cart');
  });

  it('marks the link for the current page', () => {
    render(
      <MemoryRouter initialEntries={['/coffee']}>
        <Header />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Coffee' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Tea' })).not.toHaveAttribute('aria-current');
  });
});
