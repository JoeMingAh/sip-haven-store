import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import Home from './Home.jsx';
import { routes } from '../router.jsx';
import { GUIDES } from '../data/guides.js';

// Home reads the store flag and the lineup, so each test sets both here.
const shop = vi.hoisted(() => ({ open: false, products: [] }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  isStoreOpen: () => shop.open,
}));
vi.mock('../../lib/catalog.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getProducts: () => shop.products,
}));
// The mocked array is the one Home reads, so a test can add a guide to it.
vi.mock('../data/guides.js', () => ({ GUIDES: [] }));

beforeEach(() => {
  shop.open = false;
  shop.products = [];
});
afterEach(() => {
  GUIDES.length = 0;
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
  variants: [
    {
      id: 'loose-leaf-2oz',
      format: 'loose-leaf',
      size_label: '2 oz',
      price_cents: 1800,
      stripe_price_id: 'price_123',
    },
  ],
  ...overrides,
});

const LINEUP = [
  product(),
  product({
    slug: 'dawn-roast',
    name: 'Dawn Roast',
    category: 'coffee',
    flavor_notes: ['cocoa', 'toast'],
    variants: [
      {
        id: 'whole-bean-12oz',
        format: 'whole-bean',
        size_label: '12 oz',
        price_cents: 1650,
        stripe_price_id: 'price_456',
      },
    ],
  }),
  product({ slug: 'quiet-chamomile', name: 'Quiet Chamomile', featured: false }),
];

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

function renderSite(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

const heading = (name, level = 2) => screen.getByRole('heading', { level, name });
const queryHeading = (name, level = 2) => screen.queryByRole('heading', { level, name });

// True when `first` sits above `second` on the page.
const isAbove = (first, second) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Home: welcome hero', () => {
  it('has one h1, the welcome line', () => {
    renderHome();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('A little haven in every cup.');
  });

  it('offers a tea path and a coffee path', () => {
    renderHome();
    const tea = screen.getByRole('link', { name: /i'm a tea person/i });
    const coffee = screen.getByRole('link', { name: /i'm a coffee person/i });
    expect(tea).toHaveAttribute('href', '/tea');
    expect(coffee).toHaveAttribute('href', '/coffee');
  });

  it('names the formats under each path', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /tea person/i })).toHaveTextContent(
      'Loose leaf, tea bags and K-Cups',
    );
    expect(screen.getByRole('link', { name: /coffee person/i })).toHaveTextContent(
      'Whole bean and ground',
    );
  });
});

describe('Home: store closed', () => {
  it('shows the coming-soon panel with the signup form', () => {
    renderHome();
    const panel = screen.getByRole('region', { name: 'Our first collection is brewing' });
    expect(within(panel).getByLabelText('Email address')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Join the list' })).toBeInTheDocument();
  });

  it('shows no price and nothing to buy', () => {
    const { container } = renderHome();
    expect(container).not.toHaveTextContent('$');
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument();
  });

  it('keeps products out of sight even when the lineup has some', () => {
    shop.products = LINEUP;
    const { container } = renderHome();
    expect(screen.queryByText('Jasmine Dream')).not.toBeInTheDocument();
    expect(screen.queryByText('Dawn Roast')).not.toBeInTheDocument();
    expect(queryHeading('Our picks')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('$');
    expect(heading('Our first collection is brewing')).toBeInTheDocument();
  });
});

describe('Home: store open', () => {
  beforeEach(() => {
    shop.open = true;
  });

  it('features the products marked featured, with their prices', () => {
    shop.products = LINEUP;
    renderHome();

    expect(heading('Our picks')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jasmine Dream' })).toHaveAttribute(
      'href',
      '/products/jasmine-dream',
    );
    expect(screen.getByRole('link', { name: 'Dawn Roast' })).toHaveAttribute(
      'href',
      '/products/dawn-roast',
    );
    expect(screen.getByText('from $18.00')).toBeInTheDocument();
    expect(screen.getByText('from $16.50')).toBeInTheDocument();
  });

  it('leaves out products that are not featured', () => {
    shop.products = LINEUP;
    renderHome();
    expect(screen.queryByText('Quiet Chamomile')).not.toBeInTheDocument();
  });

  it('replaces the coming-soon panel with the featured products', () => {
    shop.products = LINEUP;
    renderHome();
    expect(queryHeading('Our first collection is brewing')).not.toBeInTheDocument();
  });

  it('shows coming soon when the lineup is empty, never an empty grid', () => {
    shop.products = [];
    renderHome();
    expect(heading('Our first collection is brewing')).toBeInTheDocument();
    expect(queryHeading('Our picks')).not.toBeInTheDocument();
  });

  it('shows neither when nothing is featured', () => {
    shop.products = [product({ featured: false })];
    renderHome();
    expect(queryHeading('Our picks')).not.toBeInTheDocument();
    expect(queryHeading('Our first collection is brewing')).not.toBeInTheDocument();
    expect(screen.queryByText('Jasmine Dream')).not.toBeInTheDocument();
  });

  it('shows a featured product that cannot be bought yet, without a price', () => {
    shop.products = [product({ variants: [{ ...product().variants[0], stripe_price_id: undefined }] })];
    const { container } = renderHome();
    expect(screen.getByRole('link', { name: 'Jasmine Dream' })).toBeInTheDocument();
    expect(container).not.toHaveTextContent('$');
  });
});

describe('Home: teasers', () => {
  it('invites the visitor to the quiz', () => {
    renderHome();
    expect(screen.getByRole('link', { name: 'Take the quiz' })).toHaveAttribute('href', '/quiz');
  });

  it('points to the story page', () => {
    renderHome();
    expect(screen.getByRole('link', { name: 'Read our story' })).toHaveAttribute(
      'href',
      '/our-story',
    );
  });

  it('leaves the guides teaser out while there are no guides', () => {
    renderHome();
    expect(screen.queryByRole('link', { name: 'Read the guides' })).not.toBeInTheDocument();
    expect(queryHeading('Brewing guides')).not.toBeInTheDocument();
  });

  it('shows the guides teaser once a guide exists', () => {
    GUIDES.push({ slug: 'steeping-basics' });
    renderHome();
    expect(heading('Brewing guides')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the guides' })).toHaveAttribute(
      'href',
      '/learn',
    );
  });
});

describe('Home: order of the sections', () => {
  it('runs hero, shop panel, quiz, story, guides', () => {
    GUIDES.push({ slug: 'steeping-basics' });
    renderHome();
    const sections = [
      heading('A little haven in every cup.', 1),
      heading('Our first collection is brewing'),
      screen.getByRole('link', { name: 'Take the quiz' }),
      screen.getByRole('link', { name: 'Read our story' }),
      screen.getByRole('link', { name: 'Read the guides' }),
    ];
    for (let i = 0; i < sections.length - 1; i += 1) {
      expect(isAbove(sections[i], sections[i + 1]), `section ${i} should be above ${i + 1}`).toBe(
        true,
      );
    }
  });

  it('puts the featured products where the coming-soon panel would be', () => {
    shop.open = true;
    shop.products = LINEUP;
    renderHome();
    const sections = [
      heading('A little haven in every cup.', 1),
      heading('Our picks'),
      screen.getByRole('link', { name: 'Take the quiz' }),
      screen.getByRole('link', { name: 'Read our story' }),
    ];
    for (let i = 0; i < sections.length - 1; i += 1) {
      expect(isAbove(sections[i], sections[i + 1]), `section ${i} should be above ${i + 1}`).toBe(
        true,
      );
    }
  });
});

describe('Home: on the site', () => {
  it('is the home route, inside the layout', () => {
    renderSite('/');
    const main = screen.getByRole('main');
    expect(
      within(main).getByRole('heading', { level: 1, name: 'A little haven in every cup.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('closes with the footer signup, after the coming-soon one', () => {
    renderSite('/');
    const fields = screen.getAllByLabelText('Email address');
    expect(fields).toHaveLength(2);
    expect(within(screen.getByRole('main')).getByLabelText('Email address')).toBe(fields[0]);
    expect(within(screen.getByRole('contentinfo')).getByLabelText('Email address')).toBe(fields[1]);
  });

  it('shows no price inside the page while the store is closed', () => {
    renderSite('/');
    // The shipping strip above the header names the free-shipping threshold, so
    // look only at the page itself.
    expect(screen.getByRole('main')).not.toHaveTextContent('$');
  });
});
