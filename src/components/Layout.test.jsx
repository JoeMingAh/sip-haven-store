import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

// Every page the site is meant to have. A page that is not built yet still has to
// resolve (to a stub heading), and a page that is built must keep its h1.
const PAGES = [
  '/',
  '/tea',
  '/coffee',
  '/products/some-tea',
  '/quiz',
  '/learn',
  '/learn/some-guide',
  '/our-story',
  '/contact',
  '/shipping-returns',
  '/privacy',
  '/success',
  '/cart',
];

describe('header', () => {
  it('links to Tea, Coffee, Quiz and Our Story', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Tea' })).toHaveAttribute('href', '/tea');
    expect(within(nav).getByRole('link', { name: 'Coffee' })).toHaveAttribute('href', '/coffee');
    expect(within(nav).getByRole('link', { name: 'Quiz' })).toHaveAttribute('href', '/quiz');
    expect(within(nav).getByRole('link', { name: 'Our Story' })).toHaveAttribute(
      'href',
      '/our-story',
    );
  });

  it('shows the Sip Haven wordmark as a link home', () => {
    renderAt('/tea');
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Sip Haven' })).toHaveAttribute('href', '/');
  });
});

describe('shipping strip', () => {
  it('says free shipping starts at $50', () => {
    renderAt('/');
    expect(screen.getByText(/free shipping on orders over \$50/i)).toBeInTheDocument();
  });
});

describe('routes', () => {
  it.each(PAGES)('%s renders a page with an h1 inside the layout', (path) => {
    renderAt(path);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    const heading = within(screen.getByRole('main')).getByRole('heading', { level: 1 });
    expect(heading).not.toHaveTextContent(/couldn't find that page/i);
  });

  it('renders NotFound for an unknown route', () => {
    renderAt('/zzz');
    const main = screen.getByRole('main');
    expect(
      within(main).getByRole('heading', { level: 1, name: "We couldn't find that page" }),
    ).toBeInTheDocument();
    // Still inside the layout, so the shopper can navigate away.
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('sends every internal link in the header and footer to a real route', () => {
    renderAt('/');
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => href.startsWith('/'));

    expect(hrefs.length).toBeGreaterThanOrEqual(9);
    for (const href of hrefs) {
      const matches = matchRoutes(routes, href);
      expect(matches, `${href} matches no route`).not.toBeNull();
      expect(matches.at(-1).route.path, `${href} only matches the NotFound route`).not.toBe('*');
    }
  });
});
