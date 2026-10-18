import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  validateLineup,
  getProducts,
  getProduct,
  purchasableVariants,
  findVariant,
  fromPriceCents,
} from './catalog.js';

// Inline fixture so these tests never depend on the real lineup: one tea with
// two variants (only the first is synced to Stripe) and one coffee.
const tea = {
  slug: 'jasmine-dream',
  name: 'Jasmine Dream',
  category: 'tea',
  tea_type: 'green',
  short_description: 'Green tea scented with jasmine blossoms.',
  story: 'A gentle afternoon tea.',
  flavor_notes: ['floral', 'honey'],
  caffeine: 'low',
  ingredients: 'Green tea, jasmine blossoms',
  origin: 'Test Valley',
  brew_guide: { water_temp: '175 F', amount: '1 tsp per cup', steep_time: '2-3 minutes' },
  tags: ['floral', 'afternoon'],
  featured: true,
  images: [],
  variants: [
    {
      id: 'loose-leaf-2oz',
      format: 'loose-leaf',
      size_label: '2 oz tin',
      cups: 25,
      price_cents: 1200,
      stripe_price_id: 'price_test_jasmine_2oz',
    },
    // Not synced to Stripe yet, and cheaper, so "from" prices must ignore it.
    { id: 'tea-bags-20ct', format: 'tea-bags', size_label: '20 bags', cups: 20, price_cents: 900 },
  ],
};

const coffee = {
  slug: 'house-roast',
  name: 'House Roast',
  category: 'coffee',
  short_description: 'A balanced medium roast.',
  flavor_notes: ['cocoa', 'toasted nut'],
  caffeine: 'high',
  tags: ['everyday'],
  featured: false,
  images: [],
  variants: [
    {
      id: 'whole-bean-12oz',
      format: 'whole-bean',
      size_label: '12 oz bag',
      price_cents: 1600,
      stripe_price_id: 'price_test_house_12oz',
    },
  ],
};

const fixture = { products: [tea, coffee] };

// Validate a fresh deep copy of the fixture after `mutate` has broken it, so
// one test's damage never leaks into the next.
function validateAfter(mutate) {
  const data = structuredClone(fixture);
  mutate(data);
  return validateLineup(data);
}

describe('validateLineup', () => {
  it('passes the fixture', () => {
    expect(validateLineup(fixture)).toEqual({ ok: true, errors: [] });
  });

  it('passes an empty lineup', () => {
    expect(validateLineup({ products: [] })).toEqual({ ok: true, errors: [] });
  });

  it('fails on a duplicate slug and names both products', () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[1].slug = 'jasmine-dream';
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('House Roast');
    expect(errors[0]).toContain("'jasmine-dream'");
    expect(errors[0]).toContain('Jasmine Dream');
  });

  it('fails on a duplicate variant id within a product', () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].variants[1].id = 'loose-leaf-2oz';
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Jasmine Dream');
    expect(errors[0]).toContain("'loose-leaf-2oz'");
  });

  it('allows the same variant id in two different products', () => {
    const { ok } = validateAfter((d) => {
      d.products[1].variants[0].id = 'loose-leaf-2oz';
    });
    expect(ok).toBe(true);
  });

  it("fails on a category of 'gear'", () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[1].category = 'gear';
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('House Roast');
    expect(errors[0]).toContain("'gear'");
  });

  it("fails on a tea format of 'whole-bean'", () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].variants[0].format = 'whole-bean';
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Jasmine Dream');
    expect(errors[0]).toContain("'whole-bean'");
  });

  it("fails on a coffee format of 'loose-leaf'", () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[1].variants[0].format = 'loose-leaf';
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('House Roast');
    expect(errors[0]).toContain("'loose-leaf'");
  });

  it('fails on a format nobody sells, even when the category is also wrong', () => {
    const { errors } = validateAfter((d) => {
      d.products[0].category = 'gear';
      d.products[0].variants[0].format = 'pod';
    });
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => e.includes("'gear'"))).toBe(true);
    expect(errors.some((e) => e.includes("'pod'"))).toBe(true);
  });

  it('fails on price_cents: 0 with a plain-English message', () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].variants[0].price_cents = 0;
    });
    expect(ok).toBe(false);
    expect(errors).toEqual(["Jasmine Dream: price for 'loose-leaf-2oz' must be more than $0"]);
  });

  it.each([
    [-100, 'must be more than $0'],
    [12.5, 'whole number of cents'],
    ['1200', 'not a number'],
    [undefined, 'not a number'],
  ])('fails on a bad price of %j', (price, fragment) => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].variants[0].price_cents = price;
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Jasmine Dream: price for 'loose-leaf-2oz'");
    expect(errors[0]).toContain(fragment);
  });

  it('fails on a missing name and names the product by its slug', () => {
    const { ok, errors } = validateAfter((d) => {
      delete d.products[0].name;
    });
    expect(ok).toBe(false);
    expect(errors).toEqual(['jasmine-dream: name is required']);
  });

  it('names a product by its position when it has neither name nor slug', () => {
    const { ok, errors } = validateAfter((d) => {
      delete d.products[1].name;
      delete d.products[1].slug;
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(2);
    expect(errors.every((e) => e.startsWith('Product #2: '))).toBe(true);
  });

  it.each(['slug', 'short_description'])('fails when %s is missing', (field) => {
    const { ok, errors } = validateAfter((d) => {
      delete d.products[0][field];
    });
    expect(ok).toBe(false);
    expect(errors).toEqual([`Jasmine Dream: ${field} is required`]);
  });

  it.each(['Jasmine Dream', 'jasmine_dream', 'jasmine dream', '/jasmine'])(
    'fails on a slug that is not URL-safe: %j',
    (slug) => {
      const { ok, errors } = validateAfter((d) => {
        d.products[0].slug = slug;
      });
      expect(ok).toBe(false);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Jasmine Dream');
      expect(errors[0]).toContain('lowercase letters, numbers and dashes');
    },
  );

  it('fails on a caffeine level that is not none/low/medium/high', () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].caffeine = 'extreme';
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Jasmine Dream');
    expect(errors[0]).toContain("'extreme'");
  });

  it.each(['flavor_notes', 'tags', 'images'])('fails when %s is not a list of text', (field) => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0][field] = 'floral';
    });
    expect(ok).toBe(false);
    expect(errors).toEqual([`Jasmine Dream: ${field} must be a list of text`]);
  });

  it('fails when featured is not true or false', () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].featured = 'yes';
    });
    expect(ok).toBe(false);
    expect(errors).toEqual(['Jasmine Dream: featured must be true or false']);
  });

  it('fails when an optional text field is not text', () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].origin = 42;
    });
    expect(ok).toBe(false);
    expect(errors).toEqual(['Jasmine Dream: origin must be text']);
  });

  it('fails when a product has no variants', () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[1].variants = [];
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('House Roast');
    expect(errors[0]).toContain('at least one variant');
  });

  it('fails when a variant is missing its id or size label', () => {
    const { ok, errors } = validateAfter((d) => {
      delete d.products[0].variants[1].id;
      delete d.products[1].variants[0].size_label;
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(2);
    expect(errors.some((e) => e.startsWith('Jasmine Dream: ') && e.includes('variant #2'))).toBe(true);
    expect(errors.some((e) => e.startsWith('House Roast: ') && e.includes("'whole-bean-12oz'"))).toBe(true);
  });

  it.each([0, 2.5, '25'])('fails on a cups value of %j', (cups) => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].variants[0].cups = cups;
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Jasmine Dream: cups for 'loose-leaf-2oz'");
  });

  it('fails when stripe_price_id is not text', () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].variants[0].stripe_price_id = 12345;
    });
    expect(ok).toBe(false);
    expect(errors).toEqual(["Jasmine Dream: stripe_price_id for 'loose-leaf-2oz' must be text"]);
  });

  it('allows a variant with no stripe_price_id (not synced yet)', () => {
    // The fixture's second tea variant already has none; null counts as none too.
    const { ok } = validateAfter((d) => {
      d.products[0].variants[1].stripe_price_id = null;
    });
    expect(ok).toBe(true);
  });

  it('fails on a brew guide that is missing a part', () => {
    const { ok, errors } = validateAfter((d) => {
      delete d.products[0].brew_guide.steep_time;
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Jasmine Dream');
    expect(errors[0]).toContain('steep_time');
  });

  it('reports every problem, not just the first', () => {
    const { ok, errors } = validateAfter((d) => {
      d.products[0].variants[0].price_cents = 0;
      d.products[0].caffeine = 'extreme';
      d.products[1].category = 'gear';
    });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(3);
  });

  it('accepts the reserved subscribable field and ignores it', () => {
    const { ok } = validateAfter((d) => {
      d.products[0].subscribable = true;
    });
    expect(ok).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['an object with no products', {}],
    ['products that is not a list', { products: 'nope' }],
  ])('fails on input that is not a lineup: %s', (_label, input) => {
    const { ok, errors } = validateLineup(input);
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('products');
  });

  it('fails on a product that is not an object', () => {
    const { ok, errors } = validateLineup({ products: [tea, 'oops'] });
    expect(ok).toBe(false);
    expect(errors).toEqual(['Product #2: must be an object with a name, slug, variants and so on']);
  });
});

describe('getProducts and getProduct', () => {
  it('returns every product when no category is given', () => {
    expect(getProducts(undefined, fixture)).toEqual([tea, coffee]);
  });

  it('filters by category', () => {
    expect(getProducts('tea', fixture)).toEqual([tea]);
    expect(getProducts('coffee', fixture)).toEqual([coffee]);
  });

  it('returns an empty list for a category nobody sells', () => {
    expect(getProducts('gear', fixture)).toEqual([]);
  });

  it('returns a copy, so callers cannot reorder the stored list', () => {
    const data = structuredClone(fixture);
    getProducts(undefined, data).reverse();
    expect(data.products.map((p) => p.slug)).toEqual(['jasmine-dream', 'house-roast']);
  });

  it('returns an empty list when the data has no product list', () => {
    expect(getProducts(undefined, {})).toEqual([]);
    expect(getProducts(undefined, null)).toEqual([]);
  });

  it('finds a product by slug', () => {
    expect(getProduct('house-roast', fixture)).toBe(coffee);
  });

  it('returns undefined for an unknown slug', () => {
    expect(getProduct('nope', fixture)).toBeUndefined();
  });
});

describe('purchasableVariants', () => {
  it('keeps only variants that have a stripe_price_id', () => {
    const variants = purchasableVariants(tea);
    expect(variants).toHaveLength(1);
    expect(variants[0]).toBe(tea.variants[0]);
  });

  it('treats an empty stripe_price_id as not purchasable', () => {
    const product = structuredClone(tea);
    product.variants[0].stripe_price_id = '';
    expect(purchasableVariants(product)).toEqual([]);
  });

  it('returns an empty list for a missing product or one without variants', () => {
    expect(purchasableVariants(undefined)).toEqual([]);
    expect(purchasableVariants({ slug: 'x' })).toEqual([]);
  });
});

describe('fromPriceCents', () => {
  it("equals the purchasable variant's price, ignoring the cheaper unsynced one", () => {
    expect(fromPriceCents(tea)).toBe(tea.variants[0].price_cents);
    expect(fromPriceCents(tea)).toBe(1200);
  });

  it('is the lowest price once several variants are purchasable', () => {
    const product = structuredClone(tea);
    product.variants[1].stripe_price_id = 'price_test_jasmine_bags';
    expect(fromPriceCents(product)).toBe(900);
  });

  it('is null when nothing is purchasable, so no price can be shown', () => {
    const product = structuredClone(tea);
    delete product.variants[0].stripe_price_id;
    expect(fromPriceCents(product)).toBeNull();
    expect(fromPriceCents(undefined)).toBeNull();
  });
});

describe('findVariant', () => {
  it('is undefined for an unknown product (against the real lineup)', () => {
    expect(findVariant('nope', 'x')).toBeUndefined();
  });

  it('is undefined for a known product with an unknown variant', () => {
    expect(findVariant('jasmine-dream', 'x', fixture)).toBeUndefined();
  });

  it('returns the product and the variant', () => {
    const found = findVariant('jasmine-dream', 'loose-leaf-2oz', fixture);
    expect(found.product).toBe(tea);
    expect(found.variant).toBe(tea.variants[0]);
  });

  it('still finds a variant that is not purchasable (callers check stripe_price_id)', () => {
    const found = findVariant('jasmine-dream', 'tea-bags-20ct', fixture);
    expect(found.variant).toBe(tea.variants[1]);
    expect(found.variant.stripe_price_id).toBeUndefined();
  });
});

describe('default data', () => {
  afterEach(() => {
    vi.doUnmock('../src/data/lineup.json');
    vi.resetModules();
  });

  // With the real lineup empty, getProducts() === [] cannot tell a working
  // import from a broken one, so swap the file and check its content flows through.
  it('is the imported lineup.json, which tests can swap with vi.mock', async () => {
    vi.resetModules();
    vi.doMock('../src/data/lineup.json', () => ({ default: fixture }));
    const catalog = await import('./catalog.js');

    expect(catalog.getProducts()).toEqual([tea, coffee]);
    expect(catalog.getProducts('coffee')).toEqual([coffee]);
    expect(catalog.getProduct('jasmine-dream')).toEqual(tea);
    expect(catalog.findVariant('house-roast', 'whole-bean-12oz').variant).toEqual(
      coffee.variants[0],
    );
  });
});

// This block is pinned to the launch state ("coming soon", nothing loaded yet).
// When the first real lineup is loaded, keep the validity check and update the
// emptiness check.
describe('src/data/lineup.json', () => {
  const real = JSON.parse(
    readFileSync(new URL('../src/data/lineup.json', import.meta.url), 'utf8'),
  );

  it('validates', () => {
    expect(validateLineup(real)).toEqual({ ok: true, errors: [] });
  });

  it('has no products yet, so getProducts() is []', () => {
    expect(getProducts()).toEqual([]);
  });
});
