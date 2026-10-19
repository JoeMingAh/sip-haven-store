import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';
import { placeholderFor } from '../assets/placeholders/index.js';
import { JASMINE, DAWN, product, variant } from '../test/fixtures.js';

// The page reads the store flag and the lineup, so each test sets both here. The
// catalog functions follow the real ones, reading from this lineup.
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

// Watches what the page hands to add(), and still lets the real cart do its work.
const cartSpy = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock('../cart/CartContext.jsx', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useCart: () => {
      const cart = actual.useCart();
      return {
        ...cart,
        add: (...args) => {
          cartSpy.add(...args);
          return cart.add(...args);
        },
      };
    },
  };
});

const KEY = 'siphaven-cart-v2';

// Teas that relate to Jasmine Dream (floral, green) in different amounts.
const FRUITY = product({ slug: 'fruity-twist', name: 'Fruity Twist', tags: ['floral', 'green', 'fruity'] });
const QUIET = product({ slug: 'quiet-chamomile', name: 'Quiet Chamomile', tags: ['floral', 'herbal'] });
const SWEET = product({ slug: 'sweet-sencha', name: 'Sweet Sencha', tags: ['green'] });
const EXTRA = product({ slug: 'extra-floral', name: 'Extra Floral', tags: ['floral'] });
// Teas and coffees that do not.
const BOLD = product({ slug: 'bold-breakfast', name: 'Bold Breakfast', tags: ['malty'] });
const FLORAL_COFFEE = product({
  slug: 'floral-coffee',
  name: 'Floral Coffee',
  category: 'coffee',
  tags: ['floral'],
  variants: [variant({ id: 'ground-12oz', format: 'ground', stripe_price_id: 'price_fc' })],
});
const UNSYNCED = product({
  slug: 'unsynced-tea',
  name: 'Unsynced Tea',
  tags: ['floral', 'green'],
  variants: [variant({ stripe_price_id: undefined })],
});

beforeEach(() => {
  shop.open = true;
  shop.products = [JASMINE, DAWN, FRUITY, QUIET, SWEET, BOLD, FLORAL_COFFEE, UNSYNCED];
  window.localStorage.clear();
  cartSpy.add.mockClear();
});

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const main = () => within(screen.getByRole('main'));
const heading = (name, level = 2) => main().getByRole('heading', { level, name });
const addButton = () => main().getByRole('button', { name: 'Add to cart' });
const group = (name) => main().getByRole('group', { name });
const pick = (groupName, radioName) =>
  fireEvent.click(within(group(groupName)).getByRole('radio', { name: radioName }));
const savedCart = () => JSON.parse(window.localStorage.getItem(KEY));
const dialog = () => screen.getByRole('dialog', { name: 'Your cart' });

// True when `first` sits above `second` on the page.
const isAbove = (first, second) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Product: store closed', () => {
  it('/products/x shows the coming-soon panel and no Add to cart', () => {
    shop.open = false;
    renderAt('/products/x');
    const panel = main().getByRole('region', { name: 'Our first collection is brewing' });
    expect(within(panel).getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });

  it('has its own single h1, since the coming-soon panel is an h2', () => {
    shop.open = false;
    renderAt('/products/x');
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading('Coming soon', 1)).toBeInTheDocument();
  });

  it('tells nothing about a real product: no name, price, picker or way to buy', () => {
    shop.open = false;
    renderAt('/products/jasmine-dream');
    expect(screen.queryByText('Jasmine Dream')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
    expect(main().queryByRole('radio')).not.toBeInTheDocument();
    expect(main().queryByRole('group', { name: 'Format' })).not.toBeInTheDocument();
    expect(screen.queryByText(/add to cart|not available yet/i)).not.toBeInTheDocument();
    expect(main().getByRole('region', { name: 'Our first collection is brewing' })).toBeInTheDocument();
  });

  it('gives a real product and an unknown one the same page, so a closed shop leaks nothing', () => {
    shop.open = false;
    renderAt('/products/jasmine-dream');
    const real = screen.getByRole('main').textContent;
    cleanup();
    renderAt('/products/no-such-tea');
    expect(screen.getByRole('main').textContent).toBe(real);
  });
});

describe('Product: store open but the lineup empty', () => {
  it('shows coming soon when lineup empty, not a not-found page', () => {
    shop.products = [];
    renderAt('/products/jasmine-dream');
    expect(heading('Coming soon', 1)).toBeInTheDocument();
    expect(main().getByRole('region', { name: 'Our first collection is brewing' })).toBeInTheDocument();
    expect(screen.queryByText(/couldn't find that page/i)).not.toBeInTheDocument();
  });

  it('has its own single h1 and nothing to buy', () => {
    shop.products = [];
    renderAt('/products/x');
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByText(/add to cart|not available yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
  });

  it('goes back to a not-found page for an unknown slug as soon as the lineup has products', () => {
    shop.products = [JASMINE];
    renderAt('/products/x');
    expect(heading("We couldn't find that page", 1)).toBeInTheDocument();
  });
});

describe('Product: an unknown slug', () => {
  it('unknown slug shows not found', () => {
    renderAt('/products/does-not-exist');
    expect(heading("We couldn't find that page", 1)).toBeInTheDocument();
    expect(main().getByRole('link', { name: 'Browse tea' })).toHaveAttribute('href', '/tea');
    expect(main().getByRole('link', { name: 'Browse coffee' })).toHaveAttribute('href', '/coffee');
  });

  it('has exactly one h1 and nothing to buy', () => {
    renderAt('/products/does-not-exist');
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
  });

  it('is still inside the site, so the shopper can go somewhere else', () => {
    renderAt('/products/does-not-exist');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('does not match a slug written in another case', () => {
    renderAt('/products/Jasmine-Dream');
    expect(heading("We couldn't find that page", 1)).toBeInTheDocument();
  });
});

describe('Product: the page', () => {
  it('shows the name as the one h1 and the short description under it', () => {
    renderAt('/products/jasmine-dream');
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading('Jasmine Dream', 1)).toBeInTheDocument();
    expect(main().getByText('A floral green tea scented with jasmine blossoms.')).toBeInTheDocument();
  });

  it('puts the sections in order: gallery, name, picker, price, Add to cart, then the details', () => {
    renderAt('/products/jasmine-dream');
    const picture = screen.getByRole('main').querySelector('img');
    const parts = [
      picture,
      heading('Jasmine Dream', 1),
      group('Format'),
      group('Size'),
      main().getByText('$18.00'),
      addButton(),
      heading('Flavor notes'),
      heading('Caffeine'),
      heading('Brew guide'),
      heading('Ingredients'),
      heading('You might also like'),
    ];
    parts.slice(1).forEach((part, index) => {
      expect(isAbove(parts[index], part), `part ${index + 1} sits above part ${index + 2}`).toBe(true);
    });
  });

  it('lists the flavor notes', () => {
    renderAt('/products/jasmine-dream');
    const section = heading('Flavor notes').closest('section');
    const notes = within(section)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(notes).toEqual(['jasmine', 'honey', 'fresh grass']);
  });

  it.each([
    ['none', 'Caffeine-free'],
    ['low', 'Low'],
    ['medium', 'Medium'],
    ['high', 'High'],
  ])('says %s caffeine as "%s"', (level, text) => {
    shop.products = [product({ caffeine: level })];
    renderAt('/products/jasmine-dream');
    expect(within(heading('Caffeine').closest('section')).getByText(text)).toBeInTheDocument();
  });

  it('shows the brew guide for a tea', () => {
    renderAt('/products/jasmine-dream');
    const section = heading('Brew guide').closest('section');
    expect(section).toHaveTextContent('Water temperature');
    expect(section).toHaveTextContent('175 F');
    expect(section).toHaveTextContent('Amount');
    expect(section).toHaveTextContent('1 tsp per cup');
    expect(section).toHaveTextContent('Steep time');
    expect(section).toHaveTextContent('2 to 3 minutes');
  });

  it('calls the time a brew time for a coffee', () => {
    shop.products = [
      product({
        slug: 'dawn-roast',
        category: 'coffee',
        brew_guide: { water_temp: '200 F', amount: '2 tbsp per cup', steep_time: '4 minutes' },
        variants: DAWN.variants,
      }),
    ];
    renderAt('/products/dawn-roast');
    const section = heading('Brew guide').closest('section');
    expect(section).toHaveTextContent('Brew time');
    expect(section).not.toHaveTextContent('Steep time');
    expect(section).toHaveTextContent('4 minutes');
  });

  it('shows the ingredients', () => {
    renderAt('/products/jasmine-dream');
    expect(within(heading('Ingredients').closest('section')).getByText('Green tea, jasmine blossoms.')).toBeInTheDocument();
  });

  it('leaves out a section the lineup has nothing for, heading and all', () => {
    shop.products = [product({ flavor_notes: [], brew_guide: undefined, ingredients: undefined })];
    renderAt('/products/jasmine-dream');
    expect(main().queryByRole('heading', { name: 'Flavor notes' })).not.toBeInTheDocument();
    expect(main().queryByRole('heading', { name: 'Brew guide' })).not.toBeInTheDocument();
    expect(main().queryByRole('heading', { name: 'Ingredients' })).not.toBeInTheDocument();
    // Caffeine is always known.
    expect(heading('Caffeine')).toBeInTheDocument();
  });

  it('copes with a product that has almost nothing but a name and a variant', () => {
    shop.products = [
      {
        slug: 'bare',
        name: 'Bare Tea',
        category: 'tea',
        variants: [variant({ id: 'only', stripe_price_id: 'price_only' })],
      },
    ];
    renderAt('/products/bare');
    expect(heading('Bare Tea', 1)).toBeInTheDocument();
    expect(addButton()).toBeEnabled();
  });
});

describe('Product: the gallery', () => {
  it('shows placeholder art, drawn as decoration, when there are no photos', () => {
    renderAt('/products/jasmine-dream');
    const picture = screen.getByRole('main').querySelector('img');
    expect(picture).toHaveAttribute('src', placeholderFor(JASMINE));
    expect(picture).toHaveAttribute('alt', '');
  });

  it('shows the photo, described by the product name, when there is one', () => {
    shop.products = [{ ...JASMINE, images: ['/photos/jasmine-1.jpg'] }];
    renderAt('/products/jasmine-dream');
    const picture = main().getByRole('img', { name: 'Jasmine Dream' });
    expect(picture).toHaveAttribute('src', '/photos/jasmine-1.jpg');
  });

  it('offers no thumbnails for one photo', () => {
    shop.products = [{ ...JASMINE, images: ['/photos/jasmine-1.jpg'] }];
    renderAt('/products/jasmine-dream');
    expect(main().queryByRole('button', { name: /photo/i })).not.toBeInTheDocument();
  });

  it('lets the shopper switch between several photos', () => {
    shop.products = [{ ...JASMINE, images: ['/photos/a.jpg', '/photos/b.jpg', '/photos/c.jpg'] }];
    renderAt('/products/jasmine-dream');

    const thumbs = main().getAllByRole('button', { name: /^Show photo \d of 3$/ });
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0]).toHaveAttribute('aria-pressed', 'true');
    expect(main().getByRole('img', { name: 'Jasmine Dream' })).toHaveAttribute('src', '/photos/a.jpg');

    fireEvent.click(thumbs[2]);
    expect(main().getByRole('img', { name: 'Jasmine Dream, photo 3' })).toHaveAttribute('src', '/photos/c.jpg');
    expect(thumbs[2]).toHaveAttribute('aria-pressed', 'true');
    expect(thumbs[0]).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Product: choosing a variant', () => {
  it('offers only the variants that can be bought', () => {
    renderAt('/products/jasmine-dream');
    const formats = within(group('Format'))
      .getAllByRole('radio')
      .map((radio) => radio.closest('label').textContent);
    // The K-Cup has no stripe_price_id.
    expect(formats).toEqual(['Loose leaf', 'Tea bags']);
  });

  it('starts on the first variant that can be bought, and shows its price', () => {
    renderAt('/products/jasmine-dream');
    expect(within(group('Format')).getByRole('radio', { name: 'Loose leaf' })).toBeChecked();
    expect(within(group('Size')).getByRole('radio', { name: /2 oz/ })).toBeChecked();
    expect(main().getByText('$18.00')).toBeInTheDocument();
  });

  it('shows cups as "about N cups"', () => {
    renderAt('/products/jasmine-dream');
    expect(within(group('Size')).getByText('about 25 cups')).toBeInTheDocument();
  });

  it('updates the price when another format is chosen', () => {
    renderAt('/products/jasmine-dream');
    pick('Format', 'Tea bags');
    expect(main().getByText('$14.00')).toBeInTheDocument();
    expect(main().queryByText('$18.00')).not.toBeInTheDocument();
    expect(within(group('Size')).getByText('about 15 cups')).toBeInTheDocument();
  });

  it('skips a variant with no stripe_price_id even when it is first in the lineup', () => {
    shop.products = [
      product({
        variants: [
          variant({ id: 'k-cup-12', format: 'k-cup', price_cents: 900, stripe_price_id: undefined }),
          variant({ id: 'tea-bags-15', format: 'tea-bags', price_cents: 1400, stripe_price_id: 'price_b' }),
        ],
      }),
    ];
    renderAt('/products/jasmine-dream');
    expect(within(group('Format')).getByRole('radio', { name: 'Tea bags' })).toBeChecked();
    expect(main().getByText('$14.00')).toBeInTheDocument();
    expect(main().queryByText('$9.00')).not.toBeInTheDocument();
  });
});

describe('Product: Add to cart', () => {
  it('adds the chosen variant, saves it, and opens the cart', () => {
    renderAt('/products/jasmine-dream');
    fireEvent.click(addButton());

    expect(savedCart()).toEqual([{ slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 1 }]);
    const cart = within(dialog());
    expect(cart.getByRole('link', { name: 'Jasmine Dream' })).toBeInTheDocument();
    expect(cart.getByText('Subtotal').parentElement).toHaveTextContent('Subtotal $18.00');
  });

  it('sends the variantId of the chosen format and size, so a coffee keeps its grind', () => {
    renderAt('/products/dawn-roast');
    pick('Format', 'Ground');
    pick('Size', /2 lb/);
    fireEvent.click(addButton());

    // Not whole-bean-12oz, which is where the page started.
    expect(savedCart()).toEqual([{ slug: 'dawn-roast', variantId: 'ground-2lb', qty: 1 }]);
    expect(within(dialog()).getByText('Ground, 2 lb')).toBeInTheDocument();
  });

  it('hands add() the slug, the chosen variantId and a quantity of 1', () => {
    renderAt('/products/dawn-roast');
    pick('Format', 'Ground');
    pick('Size', /2 lb/);
    fireEvent.click(addButton());

    expect(cartSpy.add).toHaveBeenCalledTimes(1);
    expect(cartSpy.add).toHaveBeenCalledWith('dawn-roast', 'ground-2lb', 1);
  });

  it('calls add() only when Add to cart is pressed, not when a format or size is picked', () => {
    renderAt('/products/dawn-roast');
    pick('Format', 'Ground');
    pick('Size', /2 lb/);
    expect(cartSpy.add).not.toHaveBeenCalled();
  });

  it('sends the whole bean when that is what was chosen', () => {
    renderAt('/products/dawn-roast');
    pick('Format', 'Ground');
    pick('Format', 'Whole bean');
    fireEvent.click(addButton());
    expect(savedCart()).toEqual([{ slug: 'dawn-roast', variantId: 'whole-bean-12oz', qty: 1 }]);
  });

  it('raises the quantity when the same variant is added again', () => {
    renderAt('/products/jasmine-dream');
    fireEvent.click(addButton());
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    fireEvent.click(addButton());
    expect(savedCart()).toEqual([{ slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 2 }]);
  });

  it('keeps the two formats of a tea as two lines', () => {
    renderAt('/products/jasmine-dream');
    fireEvent.click(addButton());
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    pick('Format', 'Tea bags');
    fireEvent.click(addButton());
    expect(savedCart()).toEqual([
      { slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 1 },
      { slug: 'jasmine-dream', variantId: 'tea-bags-15', qty: 1 },
    ]);
  });

  it('gives focus back to the button when the cart is closed', () => {
    renderAt('/products/jasmine-dream');
    const button = addButton();
    button.focus();
    fireEvent.click(button);
    expect(dialog()).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(button).toHaveFocus();
  });

  it('shows the count on the header Cart button', () => {
    renderAt('/products/jasmine-dream');
    fireEvent.click(addButton());
    expect(screen.getByRole('button', { name: 'Cart, 1 item' })).toBeInTheDocument();
  });
});

describe('Product: nothing to buy', () => {
  it('disables the button with "Not available yet" and never says Add to cart', () => {
    renderAt('/products/unsynced-tea');
    const button = main().getByRole('button', { name: 'Not available yet' });
    expect(button).toBeDisabled();
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });

  it('shows no price and no picker for the product itself', () => {
    renderAt('/products/unsynced-tea');
    // The column beside the picture: name, description and the buying controls. Other
    // products further down the page, under "You might also like", have prices of their own.
    const buying = heading('Unsynced Tea', 1).parentElement;
    expect(buying).not.toHaveTextContent('$');
    expect(main().queryByRole('radio')).not.toBeInTheDocument();
    expect(main().queryByRole('group', { name: 'Format' })).not.toBeInTheDocument();
  });

  it('still shows the product itself', () => {
    renderAt('/products/unsynced-tea');
    expect(heading('Unsynced Tea', 1)).toBeInTheDocument();
    expect(heading('Flavor notes')).toBeInTheDocument();
  });

  it('does the same for a product with no variants at all', () => {
    shop.products = [product({ variants: [] })];
    renderAt('/products/jasmine-dream');
    expect(main().getByRole('button', { name: 'Not available yet' })).toBeDisabled();
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
  });

  it('adds nothing to the cart when the disabled button is clicked', () => {
    renderAt('/products/unsynced-tea');
    fireEvent.click(main().getByRole('button', { name: 'Not available yet' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(savedCart()).toEqual([]);
  });
});

describe('Product: you might also like', () => {
  const alsoLike = () => within(heading('You might also like').closest('section'));
  const suggested = () =>
    alsoLike()
      .getAllByRole('heading', { level: 3 })
      .map((item) => item.textContent);

  it('suggests teas of the same category that share a tag, most shared first', () => {
    renderAt('/products/jasmine-dream');
    // Fruity Twist shares floral and green; Quiet Chamomile shares floral; Sweet Sencha shares green.
    expect(suggested()).toEqual(['Fruity Twist', 'Quiet Chamomile', 'Sweet Sencha']);
  });

  it('shows each as a card that links to its page, with its price', () => {
    renderAt('/products/jasmine-dream');
    expect(alsoLike().getByRole('link', { name: 'Fruity Twist' })).toHaveAttribute(
      'href',
      '/products/fruity-twist',
    );
    expect(alsoLike().getAllByText('from $18.00')).toHaveLength(3);
  });

  it('shows at most 3', () => {
    shop.products = [...shop.products, EXTRA];
    renderAt('/products/jasmine-dream');
    expect(suggested()).toHaveLength(3);
  });

  it('never suggests the product itself, another category, a product with no shared tag, or one that cannot be bought', () => {
    renderAt('/products/jasmine-dream');
    expect(suggested()).not.toContain('Jasmine Dream');
    expect(suggested()).not.toContain('Floral Coffee');
    expect(suggested()).not.toContain('Bold Breakfast');
    expect(suggested()).not.toContain('Unsynced Tea');
  });

  it('is left out when nothing matches', () => {
    renderAt('/products/bold-breakfast');
    expect(main().queryByRole('heading', { name: 'You might also like' })).not.toBeInTheDocument();
  });

  it('is left out when the product has no tags', () => {
    shop.products = [product({ tags: [] }), FRUITY];
    renderAt('/products/jasmine-dream');
    expect(main().queryByRole('heading', { name: 'You might also like' })).not.toBeInTheDocument();
  });

  it('goes to the suggested product, whose own picker, photos and Add to cart start fresh', async () => {
    shop.products = [
      { ...JASMINE, images: ['/photos/j1.jpg', '/photos/j2.jpg', '/photos/j3.jpg'] },
      { ...FRUITY, images: ['/photos/f1.jpg', '/photos/f2.jpg'] },
    ];
    const router = renderAt('/products/jasmine-dream');
    // Leave Jasmine Dream on its second format and its third photo first.
    pick('Format', 'Tea bags');
    fireEvent.click(main().getByRole('button', { name: 'Show photo 3 of 3' }));

    fireEvent.click(alsoLike().getByRole('link', { name: 'Fruity Twist' }));
    await act(async () => {});

    expect(router.state.location.pathname).toBe('/products/fruity-twist');
    expect(heading('Fruity Twist', 1)).toBeInTheDocument();
    // Neither the format nor the photo chosen before carries over.
    expect(within(group('Format')).getByRole('radio', { name: 'Loose leaf' })).toBeChecked();
    expect(main().getByRole('img', { name: 'Fruity Twist' })).toHaveAttribute('src', '/photos/f1.jpg');
    fireEvent.click(addButton());
    expect(savedCart()).toEqual([{ slug: 'fruity-twist', variantId: 'loose-leaf-2oz', qty: 1 }]);
  });
});
