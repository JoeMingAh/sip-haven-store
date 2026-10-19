import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';
import { JASMINE, DAWN } from '../test/fixtures.js';

// /cart is where Stripe sends a shopper who cancels. It reads the store flag and the
// lineup, so each test sets both here.
const shop = vi.hoisted(() => ({ open: true, products: [] }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStoreOpen: () => shop.open,
}));
vi.mock('../../lib/catalog.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getProducts: (category) => actual.getProducts(category, shop),
    getProduct: (slug) => actual.getProduct(slug, shop),
    findVariant: (slug, id) => actual.findVariant(slug, id, shop),
  };
});

const KEY = 'siphaven-cart-v2';

beforeEach(() => {
  shop.open = true;
  shop.products = [JASMINE, DAWN];
  window.localStorage.clear();
});

const line = (slug, variantId, qty = 1) => ({ slug, variantId, qty });

function renderAt(path, lines) {
  if (lines) window.localStorage.setItem(KEY, JSON.stringify(lines));
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const dialog = () => screen.getByRole('dialog', { name: 'Your cart' });

describe('the /cart route', () => {
  it('shows the home page with the cart drawer open', () => {
    renderAt('/cart');
    expect(
      within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'A little haven in every cup.' }),
    ).toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
  });

  it('is the cart a shopper left behind at Stripe, ready to check out again', () => {
    renderAt('/cart', [line('jasmine-dream', 'loose-leaf-2oz', 2), line('dawn-roast', 'ground-12oz')]);
    expect(within(dialog()).getByRole('link', { name: 'Jasmine Dream' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('link', { name: 'Dawn Roast' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Checkout' })).toBeEnabled();
  });

  it('shows an empty cart for a visitor with nothing in it', () => {
    renderAt('/cart');
    expect(within(dialog()).getByText('Your cart is empty.')).toBeInTheDocument();
  });

  it('still has the header, the footer and the Cart button', () => {
    renderAt('/cart', [line('jasmine-dream', 'loose-leaf-2oz')]);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cart, 1 item' })).toBeInTheDocument();
  });

  it('opens the drawer once: closing it leaves the home page to browse, not a drawer that returns', () => {
    renderAt('/cart');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close cart' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();

    // The Cart button still works afterwards.
    fireEvent.click(screen.getByRole('button', { name: 'Cart' }));
    expect(dialog()).toBeInTheDocument();
  });

  it('closes the drawer when a shopper follows a link out of it', () => {
    const router = renderAt('/cart');
    fireEvent.click(within(dialog()).getByRole('link', { name: 'Browse tea' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tea');
  });

  it('closes the drawer when the shopper goes back', async () => {
    const router = renderAt('/');
    await act(() => router.navigate('/cart'));
    expect(dialog()).toBeInTheDocument();
    await act(() => router.navigate(-1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tells a shopper what was dropped from a cart saved earlier', () => {
    renderAt('/cart', [line('retired-tea', 'loose-leaf-2oz'), line('dawn-roast', 'ground-12oz')]);
    expect(
      within(dialog()).getByText('Some items in your cart are no longer available and were removed.'),
    ).toBeInTheDocument();
  });
});

describe('the /cart route while the store is closed', () => {
  beforeEach(() => {
    shop.open = false;
  });

  it('shows the coming-soon home page and an empty cart: no prices, no Checkout', () => {
    renderAt('/cart', [line('jasmine-dream', 'loose-leaf-2oz', 2)]);
    expect(within(dialog()).getByText('Your cart is empty.')).toBeInTheDocument();
    expect(dialog()).not.toHaveTextContent('$');
    expect(within(dialog()).queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument();
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
  });
});
