import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';
import { findVariant } from '../../lib/catalog.js';
import { CART_STORAGE_KEY } from '../cart/cartStorage.js';
import { PAGE_META } from '../data/pageMeta.js';

// The store flag is set by each test. The real Tasting Flight has no Stripe price yet,
// so it cannot be sold; here it has one, as it will once the price exists in Stripe.
const shop = vi.hoisted(() => ({ open: true }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStoreOpen: () => shop.open,
}));
vi.mock('../../lib/offers.js', async (importOriginal) => {
  const actual = await importOriginal();
  const flight = {
    ...actual.TASTING_FLIGHT,
    variants: actual.TASTING_FLIGHT.variants.map((variant) => ({
      ...variant,
      stripe_price_id: 'price_tasting_flight',
    })),
  };
  return { ...actual, TASTING_FLIGHT: flight, OFFERS: [flight] };
});

const CTA = 'Order the Tasting Flight — $42';

function renderPage() {
  const router = createMemoryRouter(routes, { initialEntries: ['/tasting-flight'] });
  render(<RouterProvider router={router} />);
  return router;
}

const savedCart = () => JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? '[]');

beforeEach(() => {
  shop.open = true;
  window.localStorage.clear();
});

describe('/tasting-flight', () => {
  it('shows the hero headline as the page heading, with its own title', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'An Unhurried Sanctuary in Four Tins.' }),
    ).toBeInTheDocument();
    expect(document.title).toBe(PAGE_META['/tasting-flight'].title);
  });

  it('has a real comparison table: three columns and three body rows', () => {
    renderPage();
    const table = screen.getByRole('table');
    const [head, body] = within(table).getAllByRole('rowgroup');
    expect(within(head).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'The Measure',
      'Crushed Shelf Tea',
      'Sip Haven Whole-Leaf Reserve',
    ]);
    const rows = within(body).getAllByRole('row');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(within(row).getAllByRole('rowheader')).toHaveLength(1);
      expect(within(row).getAllByRole('cell')).toHaveLength(2);
    }
    expect(within(rows[2]).getByRole('cell', { name: '48 layered cups ($0.88 per infusion)' })).toBeInTheDocument();
  });

  it('never shows the value module\'s internal label', () => {
    renderPage();
    expect(document.body.textContent).not.toMatch(/1 Tin = 45 Cups/i);
  });

  it('keeps a wide table scrolling inside its own frame, not the page', () => {
    renderPage();
    const frame = screen.getByRole('table').parentElement;
    expect(frame).toHaveClass('overflow-x-auto', 'max-w-full');
    expect(frame).toHaveAttribute('tabindex', '0');
  });

  it('shows all four cultivar cards', () => {
    renderPage();
    const names = [
      'Alishan High-Mountain Oolong',
      'Jin Xuan “Golden Daylily”',
      'Shanlinxi Cloud-Mist Oolong',
      'Sun Moon Lake Ruby #18',
    ];
    expect(screen.getAllByRole('article')).toHaveLength(4);
    for (const name of names) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
    }
  });

  it('has no card fields and loads no pictures from elsewhere', () => {
    const { container } = render(
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/tasting-flight'] })} />,
    );
    expect(container.querySelector('main input, main iframe')).toBeNull();
    for (const image of container.querySelectorAll('main img')) {
      expect(image.getAttribute('src')).not.toMatch(/^https?:/);
    }
  });

  it('adds one Tasting Flight to the cart at $42, shipping free, with RESERVE15, and opens the cart', () => {
    const router = renderPage();
    fireEvent.click(screen.getByRole('button', { name: CTA }));

    expect(router.state.location.pathname).toBe('/cart');
    expect(savedCart()).toEqual([{ slug: 'tasting-flight', variantId: 'flight-4-tins', qty: 1 }]);

    // The cart keeps only which variant and how many; the rest is the offer's.
    const [line] = savedCart();
    const { product, variant } = findVariant(line.slug, line.variantId);
    expect(product.name).toBe('Taiwanese Tasting Flight');
    expect(variant.price_cents / 100).toBe(42);
    expect(variant.free_shipping).toBe(true);
    expect(variant.credit_code).toBe('RESERVE15');

    const cart = screen.getByRole('dialog', { name: 'Your cart' });
    expect(within(cart).getByRole('link', { name: 'Taiwanese Tasting Flight' })).toHaveAttribute(
      'href',
      '/tasting-flight',
    );
    expect(within(cart).getByText("You've earned free shipping")).toBeInTheDocument();
  });

  it('keeps the button off while the store is closed, and adds nothing', () => {
    shop.open = false;
    renderPage();
    const button = screen.getByRole('button', { name: CTA });
    expect(button).toBeDisabled();
    expect(screen.getByText('Not available yet')).toBeInTheDocument();
    fireEvent.click(button);
    expect(savedCart()).toEqual([]);
  });
});
