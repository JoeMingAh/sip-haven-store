import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header.jsx';
import CartDrawer from './CartDrawer.jsx';
import { CartProvider } from '../cart/CartContext.jsx';
import { GUIDES } from '../data/guides.js';
import { JASMINE, DAWN } from '../test/fixtures.js';

// The mocked array is the one Header reads, so a test can add a guide to it.
vi.mock('../data/guides.js', () => ({ GUIDES: [] }));

// The cart button follows the store flag and counts what the cart holds, so each
// test sets the flag and the lineup here.
const shop = vi.hoisted(() => ({ open: true, products: [] }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStoreOpen: () => shop.open,
}));
vi.mock('../../lib/catalog.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findVariant: (slug, id) => actual.findVariant(slug, id, shop) };
});

const KEY = 'siphaven-cart-v2';

beforeEach(() => {
  shop.open = true;
  shop.products = [JASMINE, DAWN];
  window.localStorage.clear();
});
afterEach(() => {
  GUIDES.length = 0;
});

const line = (slug, variantId, qty = 1) => ({ slug, variantId, qty });
const seed = (lines) => window.localStorage.setItem(KEY, JSON.stringify(lines));

function renderHeader({ lines, path = '/' } = {}) {
  if (lines) seed(lines);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CartProvider>
        <Header />
        <CartDrawer />
      </CartProvider>
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

  it('marks the link for the current page', () => {
    renderHeader({ path: '/coffee' });
    expect(screen.getByRole('link', { name: 'Coffee' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Tea' })).not.toHaveAttribute('aria-current');
  });
});

describe('Header: the cart button', () => {
  it('is a button, not a link to /cart', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'Cart' })).toHaveAttribute('type', 'button');
    expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
  });

  it('says it opens a dialog', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'Cart' })).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens the cart drawer', () => {
    renderHeader({ lines: [line('jasmine-dream', 'loose-leaf-2oz')] });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cart/ }));
    expect(screen.getByRole('dialog', { name: 'Your cart' })).toBeInTheDocument();
  });

  it('gets focus back when the drawer is closed', () => {
    renderHeader();
    const button = screen.getByRole('button', { name: 'Cart' });
    button.focus();
    fireEvent.click(button);
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(button).toHaveFocus();
  });

  it('shows no count for an empty cart', () => {
    renderHeader();
    const button = screen.getByRole('button', { name: 'Cart' });
    expect(button).toHaveTextContent(/^Cart$/);
  });

  it('shows how many items are in the cart, counting units rather than lines', () => {
    renderHeader({
      lines: [line('jasmine-dream', 'loose-leaf-2oz', 2), line('dawn-roast', 'ground-12oz', 1)],
    });
    const button = screen.getByRole('button', { name: 'Cart, 3 items' });
    expect(button).toHaveTextContent('Cart3');
  });

  it('says "1 item" for one', () => {
    renderHeader({ lines: [line('jasmine-dream', 'loose-leaf-2oz', 1)] });
    expect(screen.getByRole('button', { name: 'Cart, 1 item' })).toBeInTheDocument();
  });

  it('keeps the count up to date as the cart changes', () => {
    renderHeader({ lines: [line('jasmine-dream', 'loose-leaf-2oz', 1)] });
    fireEvent.click(screen.getByRole('button', { name: 'Cart, 1 item' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Increase quantity of Jasmine Dream (Loose leaf, 2 oz)' }),
    );
    expect(screen.getByRole('button', { name: 'Cart, 2 items' })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Jasmine Dream (Loose leaf, 2 oz) from cart' }),
    );
    expect(screen.getByRole('button', { name: 'Cart' })).toBeInTheDocument();
  });

  it('shows no count while the store is closed, even with a saved cart', () => {
    shop.open = false;
    renderHeader({ lines: [line('jasmine-dream', 'loose-leaf-2oz', 2)] });
    expect(screen.getByRole('button', { name: 'Cart' })).toHaveTextContent(/^Cart$/);
  });
});

describe('sticky header', () => {
  afterEach(() => {
    window.scrollY = 0;
  });

  it('sticks to the top of the window above page content', () => {
    renderHeader();
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky', 'top-0', 'z-30', 'bg-cream');
  });

  it('has no shadow at the top of the page and gains one once scrolled', () => {
    renderHeader();
    const header = screen.getByRole('banner');
    expect(header).toHaveAttribute('data-scrolled', 'false');
    expect(header).toHaveClass('shadow-none');

    window.scrollY = 300;
    fireEvent.scroll(window);
    expect(header).toHaveAttribute('data-scrolled', 'true');
    expect(header).toHaveClass('shadow-md');

    window.scrollY = 0;
    fireEvent.scroll(window);
    expect(header).toHaveAttribute('data-scrolled', 'false');
  });
});
