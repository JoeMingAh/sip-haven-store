import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

// Every page the site is meant to have. Each must keep its h1 and must not be the
// not-found page. /learn/:slug is not listed: the guides list ships empty, so every
// guide address is the not-found page by design (see Learn.test.jsx for that route).
const PAGES = [
  '/',
  '/tea',
  '/coffee',
  '/products/some-tea',
  '/quiz',
  '/learn',
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

  it('has a Cart button that opens the cart drawer', () => {
    renderAt('/tea');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Cart' }));
    expect(screen.getByRole('dialog', { name: 'Your cart' })).toBeInTheDocument();
  });
});

describe('shipping strip', () => {
  it('says free shipping starts at $50, the amount itself included', () => {
    renderAt('/');
    expect(screen.getByText(/free shipping on orders of \$50 or more/i)).toBeInTheDocument();
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
