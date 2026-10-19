// Products for the cart, drawer, header and product page tests, shaped like the
// entries in src/data/lineup.json (see lib/catalog.js). Each test file mocks
// lib/catalog.js so the app reads whatever lineup that test sets up.

export const variant = (overrides = {}) => ({
  id: 'loose-leaf-2oz',
  format: 'loose-leaf',
  size_label: '2 oz',
  price_cents: 1800,
  stripe_price_id: 'price_loose_2oz',
  ...overrides,
});

export const product = (overrides = {}) => ({
  slug: 'jasmine-dream',
  name: 'Jasmine Dream',
  category: 'tea',
  short_description: 'A floral green tea scented with jasmine blossoms.',
  flavor_notes: ['jasmine', 'honey', 'fresh grass'],
  caffeine: 'low',
  tags: ['floral', 'green'],
  featured: false,
  images: [],
  variants: [variant()],
  ...overrides,
});

// A tea in three formats. The K-Cup is loaded but not synced to Stripe yet, so it
// has no stripe_price_id and cannot be bought.
export const JASMINE = product({
  variants: [
    variant({ cups: 25, stripe_price_id: 'price_jasmine_loose' }),
    variant({
      id: 'tea-bags-15',
      format: 'tea-bags',
      size_label: '15 bags',
      price_cents: 1400,
      cups: 15,
      stripe_price_id: 'price_jasmine_bags',
    }),
    variant({
      id: 'k-cup-12',
      format: 'k-cup',
      size_label: '12 pods',
      price_cents: 900,
      stripe_price_id: undefined,
    }),
  ],
  brew_guide: { water_temp: '175 F', amount: '1 tsp per cup', steep_time: '2 to 3 minutes' },
  ingredients: 'Green tea, jasmine blossoms.',
});

// A coffee that comes whole bean or ground, in two sizes each. A cart line has to
// remember which of the four was chosen.
export const DAWN = product({
  slug: 'dawn-roast',
  name: 'Dawn Roast',
  category: 'coffee',
  short_description: 'A medium roast with cocoa and toast.',
  flavor_notes: ['cocoa', 'toast'],
  caffeine: 'high',
  tags: ['chocolate', 'medium roast'],
  variants: [
    variant({
      id: 'whole-bean-12oz',
      format: 'whole-bean',
      size_label: '12 oz',
      price_cents: 1650,
      cups: 40,
      stripe_price_id: 'price_dawn_bean_12',
    }),
    variant({
      id: 'whole-bean-2lb',
      format: 'whole-bean',
      size_label: '2 lb',
      price_cents: 4000,
      cups: 100,
      stripe_price_id: 'price_dawn_bean_32',
    }),
    variant({
      id: 'ground-12oz',
      format: 'ground',
      size_label: '12 oz',
      price_cents: 1650,
      cups: 40,
      stripe_price_id: 'price_dawn_ground_12',
    }),
    variant({
      id: 'ground-2lb',
      format: 'ground',
      size_label: '2 lb',
      price_cents: 4000,
      cups: 100,
      stripe_price_id: 'price_dawn_ground_32',
    }),
  ],
});
