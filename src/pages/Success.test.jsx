import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';
import { JASMINE, DAWN } from '../test/fixtures.js';

// The header counts what the cart holds, and the cart looks its variants up in the
// lineup, so each test sets the store flag and the lineup here.
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
// Where Stripe sends a shopper once the payment is done (success_url in api/checkout.js).
const FROM_STRIPE = '/success?session_id=cs_test_a1B2c3D4';

let fetchMock;
beforeEach(() => {
  shop.open = true;
  shop.products = [JASMINE, DAWN];
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const line = (slug, variantId, qty = 1) => ({ slug, variantId, qty });
const TEA = line('jasmine-dream', 'loose-leaf-2oz', 2);
const COFFEE = line('dawn-roast', 'ground-12oz', 1);
const seed = (lines) => window.localStorage.setItem(KEY, JSON.stringify(lines));
const saved = () => JSON.parse(window.localStorage.getItem(KEY));

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const main = () => within(screen.getByRole('main'));
const cartButton = (name) =>
  within(screen.getByRole('banner')).getByRole('button', { name });

describe('Success: the page', () => {
  it('thanks the customer under the one h1, inside the layout', () => {
    renderAt(FROM_STRIPE);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(main().getByRole('heading', { level: 1, name: 'Thank you for your order' })).toBeInTheDocument();
  });

  it('is not the not-found page', () => {
    renderAt(FROM_STRIPE);
    expect(screen.queryByText(/couldn't find that page/i)).not.toBeInTheDocument();
  });

  it('says the receipt comes from Stripe', () => {
    renderAt(FROM_STRIPE);
    expect(main().getByText(/receipt/i)).toHaveTextContent(/Stripe/);
  });

  it('shows the same page when the address has no session id', () => {
    renderAt('/success');
    expect(main().getByRole('heading', { level: 1, name: 'Thank you for your order' })).toBeInTheDocument();
  });

  it('does not show what the address carries: the session id stays out of the page', () => {
    renderAt(FROM_STRIPE);
    expect(screen.getByRole('main')).not.toHaveTextContent('cs_test_a1B2c3D4');
    expect(screen.getByRole('main')).not.toHaveTextContent('session');
  });

  it('does not fetch anything, so the session id is never sent anywhere', async () => {
    renderAt(FROM_STRIPE);
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leads on to tea and coffee, so the page is not a dead end', () => {
    renderAt(FROM_STRIPE);
    expect(main().getByRole('link', { name: 'Browse tea' })).toHaveAttribute('href', '/tea');
    expect(main().getByRole('link', { name: 'Browse coffee' })).toHaveAttribute('href', '/coffee');
  });

  it('offers the contact page if something looks wrong', () => {
    renderAt(FROM_STRIPE);
    expect(main().getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
  });

  it('uses the filled-button look that passes contrast: sage-deep behind cream text', () => {
    renderAt(FROM_STRIPE);
    expect(main().getByRole('link', { name: 'Browse tea' })).toHaveClass('bg-sage-deep', 'text-cream');
  });

  it('keeps its text to a readable width', () => {
    renderAt(FROM_STRIPE);
    expect(screen.getByRole('main').firstElementChild).toHaveClass('max-w-prose');
  });

  it('promises no delivery time and shows no price', () => {
    renderAt(FROM_STRIPE);
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
    expect(screen.getByRole('main')).not.toHaveTextContent(/\b(days?|weeks?|hours?|business)\b/i);
  });
});

describe('Success: the cart', () => {
  it('empties the cart when the shopper arrives from Stripe', () => {
    seed([TEA, COFFEE]);
    renderAt(FROM_STRIPE);
    expect(saved()).toEqual([]);
    expect(cartButton('Cart')).toBeInTheDocument();
  });

  it('empties a cart that the shopper had been filling in the same visit', async () => {
    seed([TEA, COFFEE]);
    const router = renderAt('/');
    // Three units are in the cart before the shopper leaves for Stripe and comes back.
    expect(cartButton('Cart, 3 items')).toBeInTheDocument();

    await act(async () => {
      await router.navigate(FROM_STRIPE);
    });

    expect(main().getByRole('heading', { level: 1, name: 'Thank you for your order' })).toBeInTheDocument();
    expect(cartButton('Cart')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cart, / })).not.toBeInTheDocument();
    expect(saved()).toEqual([]);
  });

  it('leaves the cart empty for the pages the shopper visits next', async () => {
    seed([TEA]);
    const router = renderAt(FROM_STRIPE);
    await act(async () => {
      await router.navigate('/tea');
    });
    expect(saved()).toEqual([]);
    expect(cartButton('Cart')).toBeInTheDocument();
  });

  it('clears once, when the page opens: a cart that changes afterwards is left alone', () => {
    seed([TEA]);
    renderAt(FROM_STRIPE);
    expect(saved()).toEqual([]);

    // Another tab of the shop adds a coffee. This tab follows it, as it follows any change.
    seed([COFFEE]);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect(cartButton('Cart, 1 item')).toBeInTheDocument();
    expect(saved()).toEqual([COFFEE]);
  });

  it('works for an empty cart too', () => {
    renderAt(FROM_STRIPE);
    expect(saved()).toEqual([]);
    expect(cartButton('Cart')).toBeInTheDocument();
  });
});
