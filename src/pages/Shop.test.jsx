import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router.jsx';

// The shop reads the store flag and the lineup, so each test sets both here.
// getProducts follows the real one: every product, or only those in the category.
const shop = vi.hoisted(() => ({ open: false, products: [] }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStoreOpen: () => shop.open,
}));
vi.mock('../../lib/catalog.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getProducts: (category) =>
    category ? shop.products.filter((item) => item.category === category) : [...shop.products],
}));

beforeEach(() => {
  shop.open = false;
  shop.products = [];
});

const variant = (format, cents, overrides = {}) => ({
  id: `${format}-1`,
  format,
  size_label: 'one size',
  price_cents: cents,
  stripe_price_id: `price_${format}`,
  ...overrides,
});

const item = (overrides = {}) => ({
  slug: 'jasmine-dream',
  name: 'Jasmine Dream',
  category: 'tea',
  short_description: 'A floral green tea.',
  flavor_notes: ['floral', 'honey'],
  caffeine: 'low',
  tags: [],
  featured: false,
  images: [],
  variants: [variant('loose-leaf', 1800), variant('tea-bags', 1400)],
  ...overrides,
});

// Three teas and two coffees.
//   Jasmine Dream     floral, honey   low   loose leaf + tea bags   from $14.00
//   Quiet Chamomile   floral, apple   none  tea bags                from $12.00
//   Bold Breakfast    malty           high  loose leaf + K-Cup      from $13.00
//   Dawn Roast        cocoa, toast    high  whole bean + ground     from $16.50
//   Evening Decaf     caramel         none  ground                  from $15.00
const LINEUP = [
  item(),
  item({
    slug: 'quiet-chamomile',
    name: 'Quiet Chamomile',
    flavor_notes: ['floral', 'apple'],
    caffeine: 'none',
    variants: [variant('tea-bags', 1200)],
  }),
  item({
    slug: 'bold-breakfast',
    name: 'Bold Breakfast',
    flavor_notes: ['malty'],
    caffeine: 'high',
    variants: [variant('loose-leaf', 1600), variant('k-cup', 1300)],
  }),
  item({
    slug: 'dawn-roast',
    name: 'Dawn Roast',
    category: 'coffee',
    flavor_notes: ['cocoa', 'toast'],
    caffeine: 'high',
    variants: [variant('whole-bean', 1650), variant('ground', 1650)],
  }),
  item({
    slug: 'evening-decaf',
    name: 'Evening Decaf',
    category: 'coffee',
    flavor_notes: ['caramel'],
    caffeine: 'none',
    variants: [variant('ground', 1500)],
  }),
];
const TEAS = ['Jasmine Dream', 'Quiet Chamomile', 'Bold Breakfast'];
const COFFEES = ['Dawn Roast', 'Evening Decaf'];

function renderShop(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const main = () => within(screen.getByRole('main'));
// The product names in the grid, in page order.
const names = () => main().queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
const box = (label) => main().getByRole('checkbox', { name: label });
const tick = (label) => fireEvent.click(box(label));
const group = (name) => main().getByRole('group', { name });
// The labels of the boxes in a filter group, top to bottom.
const optionsIn = (name) =>
  within(group(name))
    .getAllByRole('checkbox')
    .map((checkbox) => checkbox.closest('label').textContent);
const clearButtons = () => main().queryAllByRole('button', { name: 'Clear filters' });

describe('Shop: store closed', () => {
  it('shows the coming-soon panel under its own h1', () => {
    shop.products = LINEUP;
    renderShop('/tea');
    expect(main().getByRole('heading', { level: 1, name: 'Tea' })).toBeInTheDocument();
    const panel = main().getByRole('region', { name: 'Our first collection is brewing' });
    expect(within(panel).getByLabelText('Email address')).toBeInTheDocument();
  });

  it('is headed Coffee on the coffee page', () => {
    renderShop('/coffee');
    expect(main().getByRole('heading', { level: 1, name: 'Coffee' })).toBeInTheDocument();
    expect(main().getByRole('region', { name: 'Our first collection is brewing' })).toBeInTheDocument();
  });

  it('has exactly one h1', () => {
    renderShop('/tea');
    expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows no products, prices, filters or way to buy, even with a lineup', () => {
    shop.products = LINEUP;
    renderShop('/tea');
    for (const name of [...TEAS, ...COFFEES]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
    expect(main().queryByRole('checkbox')).not.toBeInTheDocument();
    expect(main().queryByRole('group')).not.toBeInTheDocument();
    expect(main().queryByRole('button', { name: /filters/i })).not.toBeInTheDocument();
  });

  it('ignores filters in the address', () => {
    shop.products = LINEUP;
    renderShop('/tea?caffeine=none&format=tea-bags');
    expect(main().getByRole('region', { name: 'Our first collection is brewing' })).toBeInTheDocument();
    expect(screen.queryByText('Quiet Chamomile')).not.toBeInTheDocument();
  });
});

describe('Shop: store open, nothing to sell', () => {
  beforeEach(() => {
    shop.open = true;
  });

  it('shows coming soon when lineup empty', () => {
    shop.products = [];
    renderShop('/tea');
    expect(main().getByRole('heading', { level: 1, name: 'Tea' })).toBeInTheDocument();
    expect(main().getByRole('heading', { level: 2, name: 'Our first collection is brewing' })).toBeInTheDocument();
    // Never an empty grid, and nothing to filter.
    expect(main().queryByRole('list')).not.toBeInTheDocument();
    expect(main().queryByRole('group')).not.toBeInTheDocument();
    expect(main().queryByRole('checkbox')).not.toBeInTheDocument();
    // The signup form has its own status line; the product count is the one to miss.
    expect(main().queryByText(/^\d+ (tea|teas)$/)).not.toBeInTheDocument();
  });

  it('does the same on the coffee page', () => {
    shop.products = [];
    renderShop('/coffee');
    expect(main().getByRole('heading', { level: 1, name: 'Coffee' })).toBeInTheDocument();
    expect(main().getByRole('heading', { level: 2, name: 'Our first collection is brewing' })).toBeInTheDocument();
  });

  it('shows coming soon on a page whose category has no products, even when the other has some', () => {
    shop.products = LINEUP.filter((product) => product.category === 'tea');
    renderShop('/coffee');
    expect(main().getByRole('heading', { level: 2, name: 'Our first collection is brewing' })).toBeInTheDocument();
    expect(main().queryByRole('list')).not.toBeInTheDocument();
    for (const name of TEAS) expect(screen.queryByText(name)).not.toBeInTheDocument();
  });

  it('shows no price when the page is coming soon', () => {
    shop.products = [];
    renderShop('/tea');
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
  });
});

describe('Shop: store open', () => {
  beforeEach(() => {
    shop.open = true;
    shop.products = LINEUP;
  });

  it('shows only tea products on /tea', () => {
    renderShop('/tea');
    expect(names()).toEqual(TEAS);
    for (const name of COFFEES) expect(screen.queryByText(name)).not.toBeInTheDocument();
  });

  it('shows only coffee products on /coffee', () => {
    renderShop('/coffee');
    expect(names()).toEqual(COFFEES);
    for (const name of TEAS) expect(screen.queryByText(name)).not.toBeInTheDocument();
  });

  it('links each card to its product page', () => {
    renderShop('/tea');
    expect(main().getByRole('link', { name: 'Jasmine Dream' })).toHaveAttribute(
      'href',
      '/products/jasmine-dream',
    );
  });

  it('shows the from price on each card, and nothing to buy yet', () => {
    renderShop('/tea');
    expect(main().getByText('from $14.00')).toBeInTheDocument();
    expect(main().getByText('from $12.00')).toBeInTheDocument();
    expect(main().getByText('from $13.00')).toBeInTheDocument();
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });

  it('has one h1, then Filters and Products, then a card heading for each product', () => {
    renderShop('/tea');
    const headings = main().getAllByRole('heading');
    expect(headings.map((heading) => [heading.tagName, heading.textContent])).toEqual([
      ['H1', 'Tea'],
      ['H2', 'Filters'],
      ['H2', 'Products'],
      ...TEAS.map((name) => ['H3', name]),
    ]);
  });

  it('introduces the page with a line about the filters', () => {
    renderShop('/tea');
    expect(main().getByText(/flavor, a caffeine level or a format/i)).toBeInTheDocument();
  });

  it('counts the products', () => {
    renderShop('/tea');
    expect(main().getByRole('status')).toHaveTextContent('3 teas');
  });

  it('counts coffees as coffees', () => {
    renderShop('/coffee');
    expect(main().getByRole('status')).toHaveTextContent('2 coffees');
  });

  it('says "1 tea" for a single product', () => {
    shop.products = [LINEUP[0]];
    renderShop('/tea');
    expect(main().getByRole('status')).toHaveTextContent(/^1 tea$/);
  });

  it('has a live status line that is always in the page', () => {
    renderShop('/tea');
    expect(main().getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('Shop: the filters offered', () => {
  beforeEach(() => {
    shop.open = true;
    shop.products = LINEUP;
  });

  it('has a Flavor, a Caffeine and a Format group, in that order', () => {
    renderShop('/tea');
    const groups = main().getAllByRole('group');
    expect(groups.map((fieldset) => fieldset.querySelector('legend').textContent)).toEqual([
      'Flavor',
      'Caffeine',
      'Format',
    ]);
    // Each is a real fieldset, so a screen reader announces the group with its boxes.
    for (const fieldset of groups) expect(fieldset.tagName).toBe('FIELDSET');
  });

  it('offers the flavors of the teas on the page, and not the coffees', () => {
    renderShop('/tea');
    expect(optionsIn('Flavor')).toEqual(['apple', 'floral', 'honey', 'malty']);
  });

  it('offers only the caffeine levels the teas have', () => {
    renderShop('/tea');
    expect(optionsIn('Caffeine')).toEqual(['Caffeine-free', 'Low', 'High']);
  });

  it('offers the formats the teas come in, and no coffee format', () => {
    renderShop('/tea');
    expect(optionsIn('Format')).toEqual(['Loose leaf', 'Tea bags', 'K-Cup']);
  });

  it('offers the coffee options on the coffee page', () => {
    renderShop('/coffee');
    expect(optionsIn('Flavor')).toEqual(['caramel', 'cocoa', 'toast']);
    expect(optionsIn('Caffeine')).toEqual(['Caffeine-free', 'High']);
    expect(optionsIn('Format')).toEqual(['Whole bean', 'Ground']);
  });

  it('follows the products: a format nobody sells is not offered', () => {
    shop.products = LINEUP.filter((product) => product.slug !== 'bold-breakfast');
    renderShop('/tea');
    expect(optionsIn('Format')).toEqual(['Loose leaf', 'Tea bags']);
  });

  it('leaves out a group when no product has anything for it', () => {
    shop.products = LINEUP.map((product) => ({ ...product, flavor_notes: [] }));
    renderShop('/tea');
    expect(main().queryByRole('group', { name: 'Flavor' })).not.toBeInTheDocument();
    expect(main().getByRole('group', { name: 'Caffeine' })).toBeInTheDocument();
  });

  it('starts with every box unticked', () => {
    renderShop('/tea');
    for (const checkbox of main().getAllByRole('checkbox')) expect(checkbox).not.toBeChecked();
  });
});

describe('Shop: filtering', () => {
  beforeEach(() => {
    shop.open = true;
    shop.products = LINEUP;
  });

  it('narrows the products when a box is ticked, and puts it in the address', () => {
    const router = renderShop('/tea');
    tick('Caffeine-free');
    expect(box('Caffeine-free')).toBeChecked();
    expect(names()).toEqual(['Quiet Chamomile']);
    expect(router.state.location.pathname).toBe('/tea');
    expect(router.state.location.search).toBe('?caffeine=none');
  });

  it('shows products with any of the ticked values in a group', () => {
    const router = renderShop('/tea');
    tick('Low');
    tick('High');
    expect(names()).toEqual(['Jasmine Dream', 'Bold Breakfast']);
    expect(router.state.location.search).toBe('?caffeine=low&caffeine=high');
  });

  it('needs all the groups to match', () => {
    const router = renderShop('/tea');
    tick('Low');
    tick('High');
    tick('K-Cup');
    expect(names()).toEqual(['Bold Breakfast']);
    expect(router.state.location.search).toBe('?caffeine=low&caffeine=high&format=k-cup');
  });

  it('filters by flavor', () => {
    const router = renderShop('/tea');
    tick('floral');
    expect(names()).toEqual(['Jasmine Dream', 'Quiet Chamomile']);
    tick('malty');
    expect(names()).toEqual(TEAS);
    expect(router.state.location.search).toBe('?flavor=floral&flavor=malty');
  });

  it('matches a format on any of a product\'s variants', () => {
    renderShop('/tea');
    tick('Tea bags');
    expect(names()).toEqual(['Jasmine Dream', 'Quiet Chamomile']);
  });

  it('writes the same address whichever order the boxes were ticked in', () => {
    const first = renderShop('/tea');
    tick('High');
    tick('Low');
    const ticked = first.state.location.search;
    cleanup();

    const second = renderShop('/tea');
    tick('Low');
    tick('High');
    expect(second.state.location.search).toBe(ticked);
  });

  it('brings products back when a box is unticked, and tidies the address', () => {
    const router = renderShop('/tea');
    tick('Low');
    expect(names()).toEqual(['Jasmine Dream']);
    tick('Low');
    expect(names()).toEqual(TEAS);
    expect(box('Low')).not.toBeChecked();
    expect(new URLSearchParams(router.state.location.search).toString()).toBe('');
  });

  it('updates the count', () => {
    renderShop('/tea');
    tick('Low');
    expect(main().getByRole('status')).toHaveTextContent('Showing 1 of 3 teas');
    tick('High');
    expect(main().getByRole('status')).toHaveTextContent('Showing 2 of 3 teas');
  });

  it('leaves the other groups\' boxes as they were', () => {
    renderShop('/tea');
    tick('Low');
    tick('Loose leaf');
    expect(box('Low')).toBeChecked();
    expect(box('Loose leaf')).toBeChecked();
    expect(box('High')).not.toBeChecked();
    expect(box('Tea bags')).not.toBeChecked();
  });

  it('keeps the scroll position instead of jumping to the top', () => {
    renderShop('/tea');
    window.scrollTo.mockClear();
    tick('Low');
    tick('Loose leaf');
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('replaces the history entry, so Back leaves the page rather than undoing ticks', () => {
    const router = renderShop('/tea');
    tick('Low');
    expect(router.state.historyAction).toBe('REPLACE');
    tick('High');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('keeps other things in the address', () => {
    const router = renderShop('/tea?utm_source=news');
    tick('Low');
    expect(new URLSearchParams(router.state.location.search).get('utm_source')).toBe('news');
    expect(new URLSearchParams(router.state.location.search).getAll('caffeine')).toEqual(['low']);
  });
});

describe('Shop: filters from the address', () => {
  beforeEach(() => {
    shop.open = true;
    shop.products = LINEUP;
  });

  it('starts with the boxes in the address ticked and the products narrowed', () => {
    renderShop('/tea?caffeine=none&format=tea-bags');
    expect(box('Caffeine-free')).toBeChecked();
    expect(box('Tea bags')).toBeChecked();
    expect(box('Low')).not.toBeChecked();
    expect(box('Loose leaf')).not.toBeChecked();
    expect(names()).toEqual(['Quiet Chamomile']);
    expect(main().getByRole('status')).toHaveTextContent('Showing 1 of 3 teas');
  });

  it('reads a repeated parameter as several values', () => {
    renderShop('/tea?flavor=malty&flavor=apple');
    expect(box('malty')).toBeChecked();
    expect(box('apple')).toBeChecked();
    expect(names()).toEqual(['Quiet Chamomile', 'Bold Breakfast']);
  });

  it('gives the same page from a copied address', () => {
    const first = renderShop('/tea');
    tick('Low');
    tick('High');
    tick('Loose leaf');
    const address = `/tea${first.state.location.search}`;
    const shown = names();
    cleanup();

    renderShop(address);
    expect(names()).toEqual(shown);
    expect(box('Low')).toBeChecked();
    expect(box('High')).toBeChecked();
    expect(box('Loose leaf')).toBeChecked();
  });

  it('ignores values it does not know, without breaking', () => {
    renderShop('/tea?caffeine=extreme&format=ground&flavor=nope&other=1');
    expect(names()).toEqual(TEAS);
    for (const checkbox of main().getAllByRole('checkbox')) expect(checkbox).not.toBeChecked();
    expect(main().getByRole('status')).toHaveTextContent(/^3 teas$/);
    expect(clearButtons()).toHaveLength(0);
  });

  it('keeps the values it does know when others are unknown', () => {
    renderShop('/tea?caffeine=extreme&caffeine=none');
    expect(box('Caffeine-free')).toBeChecked();
    expect(names()).toEqual(['Quiet Chamomile']);
  });

  it('ignores a filter that belongs to the other category', () => {
    // K-Cup is a tea format. On the coffee page it is not offered, so it does nothing.
    renderShop('/coffee?format=k-cup&caffeine=none');
    expect(names()).toEqual(['Evening Decaf']);
    expect(main().queryByRole('checkbox', { name: 'K-Cup' })).not.toBeInTheDocument();
  });

  it('does not split values on commas', () => {
    renderShop('/tea?caffeine=low,none');
    expect(names()).toEqual(TEAS);
  });

  it('copes with empty values', () => {
    renderShop('/tea?caffeine=&format&flavor=');
    expect(names()).toEqual(TEAS);
  });
});

describe('Shop: when nothing matches', () => {
  beforeEach(() => {
    shop.open = true;
    shop.products = LINEUP;
  });

  // Quiet Chamomile is caffeine-free but only comes as tea bags.
  const matchNothing = () => {
    tick('Caffeine-free');
    tick('Loose leaf');
  };

  it('says so and offers to clear the filters', () => {
    renderShop('/tea');
    matchNothing();
    expect(main().getByText('Nothing matches those filters yet.')).toBeInTheDocument();
    expect(clearButtons()).toHaveLength(1);
  });

  it('shows no products and no empty grid', () => {
    renderShop('/tea');
    matchNothing();
    expect(names()).toEqual([]);
    expect(main().queryByRole('list')).not.toBeInTheDocument();
    expect(main().getByRole('status')).toHaveTextContent('Showing 0 of 3 teas');
  });

  it('keeps the filters on screen so one can be changed', () => {
    renderShop('/tea');
    matchNothing();
    expect(box('Caffeine-free')).toBeChecked();
    tick('Loose leaf');
    expect(names()).toEqual(['Quiet Chamomile']);
    expect(main().queryByText('Nothing matches those filters yet.')).not.toBeInTheDocument();
  });

  it('brings everything back when Clear filters is pressed', () => {
    renderShop('/tea');
    matchNothing();
    fireEvent.click(clearButtons()[0]);
    expect(names()).toEqual(TEAS);
    for (const checkbox of main().getAllByRole('checkbox')) expect(checkbox).not.toBeChecked();
    expect(main().queryByText('Nothing matches those filters yet.')).not.toBeInTheDocument();
  });

  it('shows the message when the address alone matches nothing', () => {
    renderShop('/tea?flavor=malty&caffeine=none');
    expect(main().getByText('Nothing matches those filters yet.')).toBeInTheDocument();
    expect(clearButtons()).toHaveLength(1);
  });
});

describe('Shop: clearing filters', () => {
  beforeEach(() => {
    shop.open = true;
    shop.products = LINEUP;
  });

  it('offers Clear filters only while a filter is on and something matches', () => {
    renderShop('/tea');
    expect(clearButtons()).toHaveLength(0);
    tick('Low');
    expect(clearButtons()).toHaveLength(1);
  });

  it('removes every filter from the address and keeps what is not a filter', () => {
    const router = renderShop('/tea?utm_source=news&flavor=floral&caffeine=none&format=tea-bags');
    fireEvent.click(clearButtons()[0]);
    expect(router.state.location.search).toBe('?utm_source=news');
    expect(names()).toEqual(TEAS);
  });

  it('unticks the boxes', () => {
    renderShop('/tea?flavor=floral&caffeine=none');
    expect(box('floral')).toBeChecked();
    fireEvent.click(clearButtons()[0]);
    expect(box('floral')).not.toBeChecked();
    expect(box('Caffeine-free')).not.toBeChecked();
    expect(clearButtons()).toHaveLength(0);
  });

  it('moves focus to the list of products, since the button goes away', () => {
    renderShop('/tea?caffeine=none');
    const button = clearButtons()[0];
    button.focus();
    fireEvent.click(button);
    expect(main().getByRole('heading', { level: 2, name: 'Products' })).toHaveFocus();
  });

  it('moves focus the same way from the nothing-matches message', () => {
    renderShop('/tea?flavor=malty&caffeine=none');
    const button = clearButtons()[0];
    button.focus();
    fireEvent.click(button);
    expect(main().getByRole('heading', { level: 2, name: 'Products' })).toHaveFocus();
  });
});

describe('Shop: the Filters button for small screens', () => {
  beforeEach(() => {
    shop.open = true;
    shop.products = LINEUP;
  });

  const toggle = () => main().getByRole('button', { name: /^Filters/ });

  it('starts closed', () => {
    renderShop('/tea');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens and closes the panel with the filters', () => {
    renderShop('/tea');
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('controls the panel that holds the filter groups', () => {
    renderShop('/tea');
    const panel = document.getElementById(toggle().getAttribute('aria-controls'));
    expect(panel).not.toBeNull();
    expect(panel).toContainElement(group('Flavor'));
    expect(panel).toContainElement(group('Caffeine'));
    expect(panel).toContainElement(group('Format'));
  });

  it('is a button that submits nothing', () => {
    renderShop('/tea');
    expect(toggle()).toHaveAttribute('type', 'button');
  });

  it('says how many filters are on', () => {
    renderShop('/tea');
    expect(toggle()).toHaveAccessibleName('Filters');
    tick('Low');
    tick('Tea bags');
    expect(toggle()).toHaveAccessibleName('Filters (2)');
  });

  it('keeps the panel open while boxes are ticked', () => {
    renderShop('/tea');
    fireEvent.click(toggle());
    tick('Low');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Shop: on the site', () => {
  it.each([
    ['/tea', 'Tea'],
    ['/coffee', 'Coffee'],
  ])('%s is a shop page inside the layout, headed %s', (path, title) => {
    renderShop(path);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(main().getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('shows no price on the closed shop pages', () => {
    renderShop('/coffee');
    // The shipping strip above the header names the free-shipping threshold, so
    // look only at the page itself.
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
  });
});
