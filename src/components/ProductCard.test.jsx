import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard.jsx';
import { placeholderFor } from '../assets/placeholders/index.js';

// The card follows the store's open/closed flag, so the test flips it here.
const store = vi.hoisted(() => ({ open: true }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStoreOpen: () => store.open,
}));

beforeEach(() => {
  store.open = true;
});

const variant = (overrides = {}) => ({
  id: 'loose-leaf-2oz',
  format: 'loose-leaf',
  size_label: '2 oz',
  price_cents: 1800,
  stripe_price_id: 'price_123',
  ...overrides,
});

const product = (overrides = {}) => ({
  slug: 'jasmine-dream',
  name: 'Jasmine Dream',
  category: 'tea',
  short_description: 'A floral green tea.',
  flavor_notes: ['jasmine', 'honey', 'fresh grass'],
  caffeine: 'low',
  tags: ['floral'],
  featured: true,
  images: [],
  variants: [variant()],
  ...overrides,
});

function renderCard(item) {
  return render(
    <MemoryRouter>
      <ProductCard product={item} />
    </MemoryRouter>,
  );
}

describe('ProductCard', () => {
  it('shows the name as a link to the product page', () => {
    renderCard(product());
    expect(screen.getByRole('heading', { level: 3, name: 'Jasmine Dream' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jasmine Dream' })).toHaveAttribute(
      'href',
      '/products/jasmine-dream',
    );
  });

  describe('price', () => {
    it('shows "from" the lowest price that can be bought', () => {
      renderCard(
        product({
          variants: [
            variant({ id: 'loose-leaf-2oz', price_cents: 1800, stripe_price_id: 'price_1' }),
            variant({ id: 'tea-bags-15', format: 'tea-bags', price_cents: 1400, stripe_price_id: 'price_2' }),
            // Cheaper, but not synced to Stripe, so it cannot be bought and is not "from".
            variant({ id: 'k-cup-12', format: 'k-cup', price_cents: 900, stripe_price_id: undefined }),
          ],
        }),
      );
      expect(screen.getByText('from $14.00')).toBeInTheDocument();
    });

    it.each([
      [1800, 'from $18.00'],
      [1850, 'from $18.50'],
      [999, 'from $9.99'],
      [12000, 'from $120.00'],
    ])('writes %i cents as %s', (cents, text) => {
      renderCard(product({ variants: [variant({ price_cents: cents })] }));
      expect(screen.getByText(text)).toBeInTheDocument();
    });

    it('shows no price when nothing can be bought yet', () => {
      const { container } = renderCard(
        product({ variants: [variant({ stripe_price_id: undefined })] }),
      );
      expect(screen.getByRole('link', { name: 'Jasmine Dream' })).toBeInTheDocument();
      expect(container).not.toHaveTextContent('$');
      expect(container).not.toHaveTextContent(/from/i);
    });

    it('shows no price for a product with no variants at all', () => {
      const { container } = renderCard(product({ variants: [] }));
      expect(container).not.toHaveTextContent('$');
    });
  });

  describe('flavor notes', () => {
    it('lists the notes', () => {
      renderCard(product());
      const notes = screen.getByRole('list', { name: 'Flavor notes' });
      expect(within(notes).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'jasmine',
        'honey',
        'fresh grass',
      ]);
    });

    it('shows only the first three', () => {
      renderCard(product({ flavor_notes: ['jasmine', 'honey', 'fresh grass', 'citrus', 'toast'] }));
      const notes = within(screen.getByRole('list', { name: 'Flavor notes' }));
      expect(notes.getAllByRole('listitem')).toHaveLength(3);
      expect(screen.queryByText('citrus')).not.toBeInTheDocument();
      expect(screen.queryByText('toast')).not.toBeInTheDocument();
    });

    it('leaves the list out when there are no notes', () => {
      renderCard(product({ flavor_notes: [] }));
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('image', () => {
    it("shows the product's own photo, named after the product", () => {
      renderCard(product({ images: ['/images/jasmine-dream.jpg', '/images/second.jpg'] }));
      expect(screen.getByRole('img', { name: 'Jasmine Dream' })).toHaveAttribute(
        'src',
        '/images/jasmine-dream.jpg',
      );
    });

    it('uses placeholder art when there are no images', () => {
      const item = product({ images: [] });
      const { container } = renderCard(item);
      const image = container.querySelector('img');
      expect(image).toHaveAttribute('src', placeholderFor(item));
      // The art is decoration: the name sits right beside it.
      expect(image).toHaveAttribute('alt', '');
    });

    it('picks different placeholder art for coffee', () => {
      const coffee = product({ slug: 'dawn-roast', name: 'Dawn Roast', category: 'coffee', images: [] });
      const { container } = renderCard(coffee);
      expect(container.querySelector('img')).toHaveAttribute('src', placeholderFor(coffee));
      expect(placeholderFor(coffee)).not.toBe(placeholderFor(product()));
    });
  });

  describe('when the store is closed', () => {
    it('renders nothing, even for a product that could be bought', () => {
      store.open = false;
      const { container } = renderCard(product());
      expect(container).toBeEmptyDOMElement();
    });
  });
});
