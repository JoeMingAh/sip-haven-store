import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateLineup } from '../lib/catalog.js';
import { DEFAULT_TAX_CODE } from '../lib/store-config.js';
import { aromaNotes, runCli, syncLineup } from './load-lineup.js';

// None of these tests can reach Stripe: syncLineup is handed a pretend client
// (fakeStripe below) and runCli is handed one through `createStripe`.

// ---- A valid lineup to change one detail of at a time ----------------------

const tin = (changes = {}) => ({
  id: 'loose-leaf-2-oz-tin',
  format: 'loose-leaf',
  size_label: '2 oz tin',
  cups: 25,
  price_cents: 1250,
  ...changes,
});

const bags = (changes = {}) => ({
  id: 'tea-bags-20-bags',
  format: 'tea-bags',
  size_label: '20 bags',
  cups: 20,
  price_cents: 900,
  ...changes,
});

// A tea with two variants.
const tea = (changes = {}) => ({
  slug: 'jasmine-dream',
  name: 'Jasmine Dream',
  category: 'tea',
  short_description: 'Green tea scented with jasmine blossoms.',
  flavor_notes: ['floral', 'honey'],
  caffeine: 'low',
  tags: ['everyday'],
  featured: false,
  images: [],
  variants: [tin(), bags()],
  ...changes,
});

// A coffee with one variant.
const coffee = (changes = {}) => ({
  slug: 'house-roast',
  name: 'House Roast',
  category: 'coffee',
  short_description: 'A balanced medium roast.',
  flavor_notes: ['cocoa'],
  caffeine: 'high',
  tags: [],
  featured: false,
  images: [],
  variants: [
    {
      id: 'whole-bean-12-oz-bag',
      format: 'whole-bean',
      size_label: '12 oz bag',
      price_cents: 1600,
    },
  ],
  ...changes,
});

// The same tea as it is after an earlier sync: its variants already have price ids.
const syncedTea = (changes = {}) =>
  tea({
    variants: [tin({ stripe_price_id: 'price_tin' }), bags({ stripe_price_id: 'price_bags' })],
    ...changes,
  });

// Just the tin, with its price id.
const syncedTin = () => tea({ variants: [tin({ stripe_price_id: 'price_tin' })] });

const lineupOf = (...products) => ({ products });

// A sample row from lineup-template.csv, left in by mistake.
const exampleCoffee = () => coffee({ slug: 'example-house-coffee', name: 'Example House Coffee' });

// The price ids of a product's variants, in order.
const idsOf = (product) => product.variants.map((variant) => variant.stripe_price_id);

describe('the test fixtures', () => {
  it('are a valid lineup, so a test only fails for the reason it names', () => {
    expect(validateLineup(lineupOf(tea(), coffee()))).toEqual({ ok: true, errors: [] });
    expect(validateLineup(lineupOf(syncedTea(), exampleCoffee())).ok).toBe(true);
  });
});

// ---- A pretend Stripe ------------------------------------------------------

// What Stripe says when a price id does not exist (in this account or this mode).
const noSuchPrice = (id) =>
  Object.assign(new Error(`No such price: '${id}'`), {
    type: 'StripeInvalidRequestError',
    code: 'resource_missing',
    statusCode: 404,
  });

// What the pretend Stripe account already holds.
const stripeProduct = (changes = {}) => ({
  id: 'prod_jasmine',
  active: true,
  metadata: { slug: 'jasmine-dream' },
  ...changes,
});
const stripePrice = (id, cents, changes = {}) => ({
  id,
  unit_amount: cents,
  currency: 'usd',
  active: true,
  tax_behavior: 'exclusive',
  product: 'prod_jasmine',
  ...changes,
});

// The parts of the Stripe client that load-lineup uses, as vi.fn()s. `products`
// and `prices` are what the account holds before the sync. New objects get ids
// like prod_new_1 and price_new_1, counting up.
function fakeStripe({ products = [], prices = [] } = {}) {
  let madeProducts = 0;
  let madePrices = 0;
  return {
    products: {
      search: vi.fn(async ({ query }) => {
        const slug = /^metadata\['slug'\]:'([^']*)'$/.exec(query)?.[1];
        if (slug === undefined) throw new Error(`The pretend Stripe cannot read: ${query}`);
        return { data: products.filter((product) => product.metadata?.slug === slug) };
      }),
      create: vi.fn(async (params) => {
        madeProducts += 1;
        return { id: `prod_new_${madeProducts}`, active: true, ...params };
      }),
      update: vi.fn(async (id, params) => ({ id, ...params })),
    },
    prices: {
      retrieve: vi.fn(async (id) => {
        const price = prices.find((candidate) => candidate.id === id);
        if (!price) throw noSuchPrice(id);
        return price;
      }),
      create: vi.fn(async (params) => {
        madePrices += 1;
        return { id: `price_new_${madePrices}`, active: true, ...params };
      }),
      update: vi.fn(async (id, params) => ({ id, ...params })),
    },
  };
}

const countCalls = (methods) =>
  methods.reduce((total, method) => total + method.mock.calls.length, 0);

// totalCalls counts every call to the pretend Stripe; changesMade only the ones that would
// change something in a real account (reading does not count).
const totalCalls = (stripe) =>
  countCalls([...Object.values(stripe.products), ...Object.values(stripe.prices)]);
const changesMade = (stripe) =>
  countCalls([
    stripe.products.create,
    stripe.products.update,
    stripe.prices.create,
    stripe.prices.update,
  ]);

// The argument lists of every call to a vi.fn().
const argsOf = (method) => method.mock.calls;
// The first argument of every call, which is all that the create methods take.
const paramsOf = (method) => method.mock.calls.map(([params]) => params);

// ---- syncLineup ------------------------------------------------------------

describe('syncLineup', () => {
  describe('a product Stripe has not seen', () => {
    it('creates one product and a price per variant, giving every variant its id', async () => {
      const stripe = fakeStripe();
      const { lineup } = await syncLineup(lineupOf(tea()), stripe);

      expect(stripe.products.create).toHaveBeenCalledTimes(1);
      expect(stripe.prices.create).toHaveBeenCalledTimes(2);
      expect(stripe.products.update).not.toHaveBeenCalled();
      expect(stripe.prices.update).not.toHaveBeenCalled();
      expect(idsOf(lineup.products[0])).toEqual(['price_new_1', 'price_new_2']);
    });

    it('syncs every product in the lineup, in order', async () => {
      const stripe = fakeStripe();
      const { lineup } = await syncLineup(lineupOf(tea(), coffee()), stripe);

      expect(stripe.products.create).toHaveBeenCalledTimes(2);
      expect(stripe.prices.create).toHaveBeenCalledTimes(3);
      expect(lineup.products.map((product) => product.slug)).toEqual([
        'jasmine-dream',
        'house-roast',
      ]);
      expect(lineup.products.map(idsOf)).toEqual([['price_new_1', 'price_new_2'], ['price_new_3']]);
    });

    it('looks for the product by its slug before creating it', async () => {
      const stripe = fakeStripe();
      await syncLineup(lineupOf(tea()), stripe);
      expect(stripe.products.search).toHaveBeenCalledWith({
        query: "metadata['slug']:'jasmine-dream'",
      });
    });

    it('sends the name, description and slug, with the default tax code', async () => {
      const stripe = fakeStripe();
      await syncLineup(lineupOf(tea()), stripe);
      expect(paramsOf(stripe.products.create)).toEqual([
        {
          name: 'Jasmine Dream',
          description: 'Green tea scented with jasmine blossoms.',
          tax_code: DEFAULT_TAX_CODE,
          metadata: { slug: 'jasmine-dream' },
        },
      ]);
    });

    it('creates each price in USD on the new product, tagged with slug and variant', async () => {
      const stripe = fakeStripe();
      await syncLineup(lineupOf(tea()), stripe);
      expect(paramsOf(stripe.prices.create)).toEqual([
        {
          product: 'prod_new_1',
          unit_amount: 1250,
          currency: 'usd',
          tax_behavior: 'exclusive',
          metadata: { slug: 'jasmine-dream', variant_id: 'loose-leaf-2-oz-tin' },
        },
        {
          product: 'prod_new_1',
          unit_amount: 900,
          currency: 'usd',
          tax_behavior: 'exclusive',
          metadata: { slug: 'jasmine-dream', variant_id: 'tea-bags-20-bags' },
        },
      ]);
    });

    it('creates every price tax exclusive, so Stripe Tax adds the tax at checkout', async () => {
      const stripe = fakeStripe();
      await syncLineup(lineupOf(tea(), coffee()), stripe);
      expect(paramsOf(stripe.prices.create).map((params) => params.tax_behavior)).toEqual([
        'exclusive',
        'exclusive',
        'exclusive',
      ]);
    });
  });

  describe('a product Stripe already has', () => {
    it('updates the product it finds by slug instead of creating another', async () => {
      const stripe = fakeStripe({ products: [stripeProduct()] });
      await syncLineup(lineupOf(tea({ name: 'Jasmine Dream Deluxe' })), stripe);

      expect(stripe.products.create).not.toHaveBeenCalled();
      expect(argsOf(stripe.products.update)).toEqual([
        [
          'prod_jasmine',
          {
            name: 'Jasmine Dream Deluxe',
            description: 'Green tea scented with jasmine blossoms.',
            tax_code: DEFAULT_TAX_CODE,
          },
        ],
      ]);
    });

    it('puts new prices on the product it found', async () => {
      const stripe = fakeStripe({ products: [stripeProduct()] });
      await syncLineup(lineupOf(tea()), stripe);
      expect(paramsOf(stripe.prices.create).map((params) => params.product)).toEqual([
        'prod_jasmine',
        'prod_jasmine',
      ]);
    });

    it('only picks the product with the same slug', async () => {
      const other = stripeProduct({ id: 'prod_other', metadata: { slug: 'house-roast' } });
      const stripe = fakeStripe({ products: [other] });
      await syncLineup(lineupOf(tea()), stripe);
      expect(stripe.products.create).toHaveBeenCalledTimes(1);
      expect(stripe.products.update).not.toHaveBeenCalled();
    });

    it('creates no new price when the amount and tax setting are right', async () => {
      const stripe = fakeStripe({
        products: [stripeProduct()],
        prices: [stripePrice('price_tin', 1250), stripePrice('price_bags', 900)],
      });
      const { lineup } = await syncLineup(lineupOf(syncedTea()), stripe);

      expect(stripe.prices.create).not.toHaveBeenCalled();
      expect(stripe.prices.update).not.toHaveBeenCalled();
      expect(idsOf(lineup.products[0])).toEqual(['price_tin', 'price_bags']);
    });

    it('creates a new price and turns the old one off when the amount changed', async () => {
      const stripe = fakeStripe({
        products: [stripeProduct()],
        prices: [stripePrice('price_tin', 1000), stripePrice('price_bags', 900)],
      });
      const { lineup } = await syncLineup(lineupOf(syncedTea()), stripe);

      expect(paramsOf(stripe.prices.create)).toEqual([
        {
          product: 'prod_jasmine',
          unit_amount: 1250,
          currency: 'usd',
          tax_behavior: 'exclusive',
          metadata: { slug: 'jasmine-dream', variant_id: 'loose-leaf-2-oz-tin' },
        },
      ]);
      expect(argsOf(stripe.prices.update)).toEqual([['price_tin', { active: false }]]);
      // The new id replaces the old one; the unchanged variant keeps its own.
      expect(idsOf(lineup.products[0])).toEqual(['price_new_1', 'price_bags']);
    });

    it('replaces a price with the wrong tax setting, even at the right amount', async () => {
      const stripe = fakeStripe({
        products: [stripeProduct()],
        prices: [stripePrice('price_tin', 1250, { tax_behavior: 'unspecified' })],
      });
      const { lineup } = await syncLineup(lineupOf(syncedTin()), stripe);

      expect(paramsOf(stripe.prices.create)).toEqual([
        {
          product: 'prod_jasmine',
          unit_amount: 1250,
          currency: 'usd',
          tax_behavior: 'exclusive',
          metadata: { slug: 'jasmine-dream', variant_id: 'loose-leaf-2-oz-tin' },
        },
      ]);
      expect(argsOf(stripe.prices.update)).toEqual([['price_tin', { active: false }]]);
      expect(idsOf(lineup.products[0])).toEqual(['price_new_1']);
    });

    it('creates the new price before it turns the old one off', async () => {
      const stripe = fakeStripe({
        products: [stripeProduct()],
        prices: [stripePrice('price_tin', 1000)],
      });
      await syncLineup(lineupOf(syncedTin()), stripe);

      const [created] = stripe.prices.create.mock.invocationCallOrder;
      const [turnedOff] = stripe.prices.update.mock.invocationCallOrder;
      expect(created).toBeLessThan(turnedOff);
    });

    it('treats a blank stripe_price_id as no price at all', async () => {
      const stripe = fakeStripe({ products: [stripeProduct()] });
      await syncLineup(lineupOf(tea({ variants: [tin({ stripe_price_id: '' })] })), stripe);
      expect(stripe.prices.retrieve).not.toHaveBeenCalled();
      expect(stripe.prices.create).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['Stripe has no price with that id (a test id used with a live key)', undefined, false],
      [
        'the price was turned off in Stripe',
        stripePrice('price_tin', 1250, { active: false }),
        false,
      ],
      [
        'the price is not in US dollars',
        stripePrice('price_tin', 1250, { currency: 'eur' }),
        true,
      ],
      [
        'the price is tax inclusive',
        stripePrice('price_tin', 1250, { tax_behavior: 'inclusive' }),
        true,
      ],
      [
        'the price has no tax setting yet (unspecified)',
        stripePrice('price_tin', 1250, { tax_behavior: 'unspecified' }),
        true,
      ],
      [
        'the price has no tax_behavior at all',
        stripePrice('price_tin', 1250, { tax_behavior: undefined }),
        true,
      ],
    ])('makes a new price when %s', async (_why, existing, turnsOldOff) => {
      const prices = existing ? [existing] : [];
      const stripe = fakeStripe({ products: [stripeProduct()], prices });
      const { lineup } = await syncLineup(lineupOf(syncedTin()), stripe);

      expect(stripe.prices.create).toHaveBeenCalledTimes(1);
      expect(idsOf(lineup.products[0])).toEqual(['price_new_1']);
      expect(stripe.prices.update).toHaveBeenCalledTimes(turnsOldOff ? 1 : 0);
    });

    it('does not hide a Stripe error other than "no such price"', async () => {
      const stripe = fakeStripe({ products: [stripeProduct()] });
      stripe.prices.retrieve.mockRejectedValue(
        Object.assign(new Error('Could not connect to Stripe'), { code: 'api_connection_error' }),
      );

      await expect(syncLineup(lineupOf(syncedTin()), stripe)).rejects.toThrow(
        'Could not connect to Stripe',
      );
      expect(changesMade(stripe)).toBe(0);
    });

    it('finds the product through its prices when Stripe search has not caught up', async () => {
      // Search can lag by a minute, so a product made moments ago may not be found by slug.
      const stripe = fakeStripe({
        products: [],
        prices: [stripePrice('price_tin', 1250), stripePrice('price_bags', 900)],
      });
      await syncLineup(lineupOf(syncedTea()), stripe);

      expect(stripe.products.create).not.toHaveBeenCalled();
      expect(argsOf(stripe.products.update).map(([id]) => id)).toEqual(['prod_jasmine']);
    });

    it('turns an archived product back on and says so', async () => {
      const stripe = fakeStripe({ products: [stripeProduct({ active: false })] });
      const { report } = await syncLineup(lineupOf(tea()), stripe);

      expect(stripe.products.update).toHaveBeenCalledWith(
        'prod_jasmine',
        expect.objectContaining({ active: true }),
      );
      expect(report[0]).toBe(
        'Jasmine Dream: updated product prod_jasmine and turned it back on (it was archived).',
      );
    });

    it('stops before changing anything when Stripe has two products with one slug', async () => {
      const stripe = fakeStripe({
        products: [stripeProduct({ id: 'prod_a' }), stripeProduct({ id: 'prod_b' })],
      });
      // The coffee comes first and is fine, but it must not be created either.
      const attempt = syncLineup(lineupOf(coffee(), tea()), stripe);

      await expect(attempt).rejects.toThrow(
        "Stripe has 2 products with the slug 'jasmine-dream' (prod_a, prod_b)",
      );
      expect(changesMade(stripe)).toBe(0);
    });
  });

  describe('product details', () => {
    const HTTPS_IMAGE = 'https://cdn.example.com/jasmine.jpg';
    const HTTP_IMAGE = 'http://cdn.example.com/jasmine.jpg';
    const SECOND_IMAGE = 'https://cdn.example.com/two.jpg';

    it("uses the product's own tax code when it has one", async () => {
      const stripe = fakeStripe();
      await syncLineup(lineupOf(tea({ tax_code: 'txcd_41050008' })), stripe);
      expect(paramsOf(stripe.products.create)[0].tax_code).toBe('txcd_41050008');
    });

    it('falls back to the default tax code when the tax code is blank', async () => {
      const stripe = fakeStripe();
      await syncLineup(lineupOf(tea({ tax_code: '   ' })), stripe);
      expect(paramsOf(stripe.products.create)[0].tax_code).toBe(DEFAULT_TAX_CODE);
    });

    it.each([
      ['a full https address', [HTTPS_IMAGE, SECOND_IMAGE], HTTPS_IMAGE],
      ['a full http address', [HTTP_IMAGE], HTTP_IMAGE],
      ['a path on the shop', ['/images/jasmine.jpg'], undefined],
      ['a bare file name', ['jasmine.jpg'], undefined],
      ['an address that is not a web page', ['ftp://cdn.example.com/jasmine.jpg'], undefined],
      ['a relative first image, even if a later one is full', ['/a.jpg', SECOND_IMAGE], undefined],
      ['no images at all', [], undefined],
    ])('sends the first image only if it is a web address: %s', async (_case, images, sent) => {
      const stripe = fakeStripe();
      await syncLineup(lineupOf(tea({ images })), stripe);

      const [params] = paramsOf(stripe.products.create);
      if (sent) {
        expect(params.images).toEqual([sent]);
      } else {
        expect(params).not.toHaveProperty('images');
      }
    });

    it('sends the same details when it updates a product', async () => {
      const stripe = fakeStripe({ products: [stripeProduct()] });
      await syncLineup(lineupOf(tea({ tax_code: 'txcd_41050008', images: [HTTPS_IMAGE] })), stripe);
      expect(stripe.products.update).toHaveBeenCalledWith('prod_jasmine', {
        name: 'Jasmine Dream',
        description: 'Green tea scented with jasmine blossoms.',
        tax_code: 'txcd_41050008',
        images: [HTTPS_IMAGE],
      });
    });
  });

  describe('safety checks', () => {
    // Refused attempts all look the same: it rejects, and Stripe was not touched.
    async function expectRefused(options, message) {
      const stripe = fakeStripe();
      await expect(syncLineup(lineupOf(tea()), stripe, options)).rejects.toThrow(message);
      expect(totalCalls(stripe)).toBe(0);
    }

    const LIVE_REFUSAL = 'Refusing to use a live Stripe key without --live';

    it('refuses a live key without --live, before any Stripe call', async () => {
      await expectRefused({ live: false, apiKey: 'sk_live_abc123' }, LIVE_REFUSAL);
    });

    it('refuses a live key when live is left out', async () => {
      await expectRefused({ apiKey: 'sk_live_abc123' }, LIVE_REFUSAL);
    });

    it('refuses a restricted live key (rk_live_) the same way', async () => {
      await expectRefused({ live: false, apiKey: 'rk_live_abc123' }, LIVE_REFUSAL);
    });

    it('refuses a key that is not a Stripe secret key, before any Stripe call', async () => {
      await expectRefused({ live: true, apiKey: 'pk_test_abc123' }, 'does not look like a Stripe');
    });

    it('goes ahead with a live key when live is true', async () => {
      const stripe = fakeStripe();
      await syncLineup(lineupOf(tea()), stripe, { live: true, apiKey: 'sk_live_abc123' });
      expect(stripe.products.create).toHaveBeenCalledTimes(1);
    });

    it('goes ahead with a test key whether or not live is set', async () => {
      for (const live of [false, true]) {
        const stripe = fakeStripe();
        await syncLineup(lineupOf(tea()), stripe, { live, apiKey: 'sk_test_abc123' });
        expect(stripe.products.create).toHaveBeenCalledTimes(1);
      }
    });

    it('has nothing to check when it is given no key', async () => {
      const stripe = fakeStripe();
      await syncLineup(lineupOf(tea()), stripe);
      expect(stripe.products.create).toHaveBeenCalledTimes(1);
    });

    it('throws before any Stripe call for an invalid lineup, listing every problem', async () => {
      const stripe = fakeStripe();
      const bad = lineupOf(tea({ name: '' }), coffee({ variants: [] }));
      const error = await syncLineup(bad, stripe).catch((caught) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('The lineup has 2 problems, so nothing was sent to Stripe');
      expect(error.message).toContain('jasmine-dream: name is required');
      expect(error.message).toContain('House Roast: needs at least one variant');
      expect(totalCalls(stripe)).toBe(0);
    });

    it('throws before any Stripe call when the lineup is not a lineup at all', async () => {
      const stripe = fakeStripe();
      await expect(syncLineup(null, stripe)).rejects.toThrow('nothing was sent to Stripe');
      await expect(syncLineup({ products: 'tea' }, stripe)).rejects.toThrow(
        'nothing was sent to Stripe',
      );
      expect(totalCalls(stripe)).toBe(0);
    });

    it('refuses template example products, naming them, before any Stripe call', async () => {
      const stripe = fakeStripe();
      const withExamples = lineupOf(
        tea({ slug: 'example-green-tea', name: 'Example Green Tea' }),
        exampleCoffee(),
      );
      const error = await syncLineup(withExamples, stripe).catch((caught) => caught);

      expect(error.message).toContain('example-green-tea, example-house-coffee');
      expect(error.message).toContain('lineup-template.csv');
      expect(error.message).toContain('Nothing was sent to Stripe');
      expect(totalCalls(stripe)).toBe(0);
    });

    it('sends nothing at all when only some products are examples', async () => {
      const stripe = fakeStripe();
      const error = await syncLineup(lineupOf(tea(), exampleCoffee()), stripe).catch(
        (caught) => caught,
      );

      expect(error.message).toContain('example-house-coffee');
      expect(error.message).not.toContain('jasmine-dream');
      expect(totalCalls(stripe)).toBe(0);
    });

    it('only counts a slug that starts with example-', async () => {
      const stripe = fakeStripe();
      const lineup = lineupOf(tea({ slug: 'an-example-tea' }), coffee({ slug: 'examples' }));
      await syncLineup(lineup, stripe);
      expect(stripe.products.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('the result', () => {
    it('does not change the lineup it was given', async () => {
      const input = lineupOf(
        tea({
          story: 'A long story.',
          subscribable: true,
          variants: [tin({ stripe_price_id: 'price_tin' }), bags()],
        }),
        coffee(),
      );
      const before = structuredClone(input);
      const stripe = fakeStripe({
        products: [stripeProduct()],
        prices: [stripePrice('price_tin', 1000)],
      });
      const { lineup } = await syncLineup(input, stripe);

      expect(input).toEqual(before);
      expect(lineup).not.toBe(input);
      expect(idsOf(lineup.products[0])).toEqual(['price_new_1', 'price_new_2']);
    });

    it('keeps every other field exactly as it was', async () => {
      const input = lineupOf(
        tea({ story: 'A long story.', subscribable: true, tax_code: 'txcd_41050008' }),
      );
      const { lineup } = await syncLineup(input, fakeStripe());

      const withoutIds = (product) => {
        const copy = structuredClone(product);
        for (const variant of copy.variants) delete variant.stripe_price_id;
        return copy;
      };
      expect(withoutIds(lineup.products[0])).toEqual(withoutIds(input.products[0]));
    });

    it('returns an empty lineup untouched, without calling Stripe', async () => {
      const stripe = fakeStripe();
      const { lineup, report } = await syncLineup({ products: [] }, stripe);

      expect(lineup).toEqual({ products: [] });
      expect(report).toEqual([
        'The lineup has no products, so there was nothing to send to Stripe.',
      ]);
      expect(totalCalls(stripe)).toBe(0);
    });
  });

  describe('the report', () => {
    it('says in plain English what happened to each product and price', async () => {
      const stripe = fakeStripe({
        products: [stripeProduct()],
        prices: [stripePrice('price_tin', 1000), stripePrice('price_bags', 900)],
      });
      const { report } = await syncLineup(lineupOf(syncedTea(), coffee()), stripe);

      expect(report).toEqual([
        'Jasmine Dream: updated product prod_jasmine.',
        'Jasmine Dream, 2 oz tin: price_tin is $10.00, not $12.50. ' +
          'Created price_new_1 and turned price_tin off.',
        'Jasmine Dream, 20 bags: kept price_bags ($9.00).',
        'House Roast: created product prod_new_1.',
        'House Roast, 12 oz bag: created price_new_2 ($16.00).',
        'Done: 1 product created, 1 updated; 2 prices created, 1 kept.',
      ]);
    });

    it.each([
      [
        'no such price',
        undefined,
        'Jasmine Dream, 2 oz tin: Stripe has no price_tin. Created price_new_1 ($12.50).',
      ],
      [
        'a price that was turned off',
        stripePrice('price_tin', 1250, { active: false }),
        'Jasmine Dream, 2 oz tin: price_tin is already turned off in Stripe. ' +
          'Created price_new_1 ($12.50).',
      ],
      [
        'a price in another currency',
        stripePrice('price_tin', 1250, { currency: 'eur' }),
        'Jasmine Dream, 2 oz tin: price_tin is in EUR, not USD. ' +
          'Created price_new_1 and turned price_tin off.',
      ],
      [
        'a tax inclusive price',
        stripePrice('price_tin', 1250, { tax_behavior: 'inclusive' }),
        'Jasmine Dream, 2 oz tin: price_tin has a different tax setting (inclusive), ' +
          'not exclusive. Created price_new_1 and turned price_tin off.',
      ],
      [
        'a price with no tax setting yet',
        stripePrice('price_tin', 1250, { tax_behavior: 'unspecified' }),
        'Jasmine Dream, 2 oz tin: price_tin has a different tax setting (unspecified), ' +
          'not exclusive. Created price_new_1 and turned price_tin off.',
      ],
      [
        'a price with no tax_behavior at all',
        stripePrice('price_tin', 1250, { tax_behavior: undefined }),
        'Jasmine Dream, 2 oz tin: price_tin has a different tax setting (not set), ' +
          'not exclusive. Created price_new_1 and turned price_tin off.',
      ],
    ])('explains why it replaced a price: %s', async (_case, existing, expected) => {
      const prices = existing ? [existing] : [];
      const stripe = fakeStripe({ products: [stripeProduct()], prices });
      const { report } = await syncLineup(lineupOf(syncedTin()), stripe);
      expect(report).toContain(expected);
    });

    it('uses plain ASCII only, so it prints the same in every terminal', async () => {
      const { report } = await syncLineup(lineupOf(tea(), coffee()), fakeStripe());
      for (const line of report) expect(line).toMatch(/^[\x20-\x7e]+$/);
    });
  });

  describe('when Stripe fails part-way', () => {
    it('hands back the price ids made so far on the error, so none are lost', async () => {
      const stripe = fakeStripe();
      stripe.products.create
        .mockResolvedValueOnce({ id: 'prod_ok' })
        .mockRejectedValueOnce(new Error('Stripe is down'));
      const error = await syncLineup(lineupOf(tea(), coffee()), stripe).catch((caught) => caught);

      expect(error.message).toBe('Stripe is down');
      expect(error.partial.lineup.products.map(idsOf)).toEqual([
        ['price_new_1', 'price_new_2'],
        [undefined],
      ]);
      expect(error.partial.report).toEqual([
        'Jasmine Dream: created product prod_ok.',
        'Jasmine Dream, 2 oz tin: created price_new_1 ($12.50).',
        'Jasmine Dream, 20 bags: created price_new_2 ($9.00).',
      ]);
    });

    it('keeps a new price id even if turning the old price off fails', async () => {
      const stripe = fakeStripe({
        products: [stripeProduct()],
        prices: [stripePrice('price_tin', 1000)],
      });
      stripe.prices.update.mockRejectedValue(new Error('Stripe is down'));
      const error = await syncLineup(lineupOf(syncedTin()), stripe).catch((caught) => caught);

      expect(idsOf(error.partial.lineup.products[0])).toEqual(['price_new_1']);
    });

    it('gives no partial result when Stripe fails while it is only being read', async () => {
      const stripe = fakeStripe();
      stripe.products.search.mockRejectedValue(new Error('Invalid API Key provided'));
      const error = await syncLineup(lineupOf(tea()), stripe).catch((caught) => caught);

      expect(error.message).toBe('Invalid API Key provided');
      expect(error.partial).toBeUndefined();
      expect(changesMade(stripe)).toBe(0);
    });
  });
});

// ---- aromaNotes ------------------------------------------------------------

describe('aromaNotes', () => {
  const NO_AROMA =
    'Note: Jasmine Dream has no aroma the quiz looks for, so the aroma question will not find ' +
    'it. Fill in its aromas column (LINEUP-GUIDE.md lists the words).';

  it('has nothing to say when every product has aromas the quiz knows', () => {
    const lineup = lineupOf(tea({ aromas: ['jasmine', 'Honey '] }), coffee({ aromas: ['roasted'] }));
    expect(aromaNotes(lineup)).toEqual([]);
  });

  it.each([
    ['no aromas field', undefined],
    ['an empty list', []],
    ['only blank words', ['', '  ']],
  ])('notes a product with %s', (_case, aromas) => {
    expect(aromaNotes(lineupOf(tea({ aromas })))).toEqual([NO_AROMA]);
  });

  it('notes aroma words the quiz does not look for, and whether any it does are left', () => {
    expect(aromaNotes(lineupOf(tea({ aromas: ['jasmin', 'honey'] })))).toEqual([
      "Note: the quiz does not look for these aromas of Jasmine Dream: 'jasmin'. " +
        'Check the spelling if they should count.',
    ]);
    expect(aromaNotes(lineupOf(tea({ aromas: ['jasmin', 'hunny'] })))).toEqual([
      NO_AROMA,
      "Note: the quiz does not look for these aromas of Jasmine Dream: 'jasmin', 'hunny'. " +
        'Check the spelling if they should count.',
    ]);
  });

  it('copes with a lineup that is not one, leaving that to validation', () => {
    expect(aromaNotes(null)).toEqual([]);
    expect(aromaNotes({ products: 'nope' })).toEqual([]);
    expect(aromaNotes({ products: [null, { slug: 'no-name' }] })).toEqual([]);
  });

  it('uses plain ASCII only', () => {
    for (const line of aromaNotes(lineupOf(tea({ aromas: ['jasmin'] })))) {
      expect(line).toMatch(/^[\x20-\x7e]+$/);
    }
  });
});

// ---- runCli ----------------------------------------------------------------

describe('runCli', () => {
  const TEST_KEY = 'sk_test_pretend';
  const LIVE_KEY = 'sk_live_pretend';

  // Runs the command against a pretend Stripe, an in-memory lineup.json and a
  // made-up environment, so nothing real is read, written or sent.
  async function run(args = [], options = {}) {
    const {
      lineup = lineupOf(tea()),
      stripe = fakeStripe(),
      env = { STRIPE_SECRET_KEY: TEST_KEY },
      ...io
    } = options;
    const result = { written: [], log: [], error: [], stripe };
    result.readText = vi.fn(() => (typeof lineup === 'string' ? lineup : JSON.stringify(lineup)));
    result.createStripe = vi.fn(() => stripe);
    result.code = await runCli(args, {
      env,
      readText: result.readText,
      writeText: (json) => result.written.push(json),
      createStripe: result.createStripe,
      log: (line) => result.log.push(line),
      logError: (line) => result.error.push(line),
      ...io,
    });
    return result;
  }

  describe('a normal run', () => {
    it('syncs, writes the lineup back with its price ids as indented JSON, exits 0', async () => {
      const { code, written, error, createStripe } = await run();

      expect(code).toBe(0);
      expect(error).toEqual([]);
      expect(createStripe).toHaveBeenCalledWith(TEST_KEY);
      expect(written).toHaveLength(1);
      const saved = JSON.parse(written[0]);
      expect(saved.products.map(idsOf)).toEqual([['price_new_1', 'price_new_2']]);
      expect(written[0]).toBe(`${JSON.stringify(saved, null, 2)}\n`);
    });

    it('prints the report, then says the file was written', async () => {
      const { log } = await run();

      expect(log).toContain('Jasmine Dream: created product prod_new_1.');
      expect(log).toContain('Jasmine Dream, 2 oz tin: created price_new_1 ($12.50).');
      expect(log.at(-1)).toBe('Wrote src/data/lineup.json with the Stripe price ids.');
    });

    it('prints a note for a product the aroma question cannot find, and still loads it', async () => {
      const { code, log, written } = await run([], { lineup: lineupOf(tea(), coffee({ aromas: ['cocoa'] })) });

      expect(code).toBe(0);
      expect(log.filter((line) => line.startsWith('Note: '))).toEqual([
        expect.stringContaining('Jasmine Dream has no aroma the quiz looks for'),
      ]);
      expect(JSON.parse(written[0]).products).toHaveLength(2);
    });

    it('keeps the aromas in lineup.json when it writes the price ids back', async () => {
      const { written } = await run([], { lineup: lineupOf(tea({ aromas: ['jasmine', 'honey'] })) });
      expect(JSON.parse(written[0]).products[0].aromas).toEqual(['jasmine', 'honey']);
    });

    it('says it is using a test key, and never prints the key', async () => {
      const { log, error } = await run();
      expect(log[0]).toBe('Using a Stripe test key.');
      expect([...log, ...error].join('\n')).not.toContain(TEST_KEY);
    });

    it('ignores spaces around the key', async () => {
      const env = { STRIPE_SECRET_KEY: `  ${TEST_KEY}\n` };
      const { code, createStripe } = await run([], { env });
      expect(code).toBe(0);
      expect(createStripe).toHaveBeenCalledWith(TEST_KEY);
    });
  });

  describe('live keys', () => {
    it('refuses a live key without --live, before reading the lineup or Stripe', async () => {
      const { code, written, error, readText, createStripe, stripe } = await run([], {
        env: { STRIPE_SECRET_KEY: LIVE_KEY },
      });

      expect(code).toBe(1);
      expect(error.join('\n')).toContain('Refusing to use a live Stripe key without --live');
      expect(error.join('\n')).toContain('npm run load-lineup -- --live');
      expect(error.join('\n')).not.toContain(LIVE_KEY);
      expect(written).toEqual([]);
      expect(readText).not.toHaveBeenCalled();
      expect(createStripe).not.toHaveBeenCalled();
      expect(totalCalls(stripe)).toBe(0);
    });

    it('refuses a restricted live key without --live too', async () => {
      const env = { STRIPE_SECRET_KEY: 'rk_live_pretend' };
      const { code, createStripe } = await run([], { env });
      expect(code).toBe(1);
      expect(createStripe).not.toHaveBeenCalled();
    });

    it('uses a live key when --live is given, and says so loudly', async () => {
      const env = { STRIPE_SECRET_KEY: LIVE_KEY };
      const { code, log, createStripe, written } = await run(['--live'], { env });

      expect(code).toBe(0);
      expect(createStripe).toHaveBeenCalledWith(LIVE_KEY);
      expect(log[0]).toBe('Using a LIVE Stripe key: this changes the real shop.');
      expect(written).toHaveLength(1);
    });

    it('still says it is a test key when --live is given with a test key', async () => {
      const { code, log } = await run(['--live']);
      expect(code).toBe(0);
      expect(log[0]).toBe('Using a Stripe test key.');
    });
  });

  describe('the key and the arguments', () => {
    it.each([
      ['missing', {}],
      ['blank', { STRIPE_SECRET_KEY: '   ' }],
    ])('explains how to set STRIPE_SECRET_KEY when it is %s', async (_case, env) => {
      const { code, written, error, readText, createStripe } = await run([], { env });

      expect(code).toBe(1);
      expect(error.join('\n')).toContain('STRIPE_SECRET_KEY is not set');
      expect(error.join('\n')).toContain('.env.local');
      expect(written).toEqual([]);
      expect(readText).not.toHaveBeenCalled();
      expect(createStripe).not.toHaveBeenCalled();
    });

    it('refuses a key that is not a Stripe secret key', async () => {
      const env = { STRIPE_SECRET_KEY: 'pk_test_pretend' };
      const { code, error, createStripe } = await run([], { env });

      expect(code).toBe(1);
      expect(error.join('\n')).toContain('does not look like a Stripe secret key');
      expect(createStripe).not.toHaveBeenCalled();
    });

    it.each([['--lve'], ['lineup.csv'], ['--live', 'extra']])(
      'prints how to use it and exits 1 for the arguments %j',
      async (...args) => {
        const { code, error, createStripe, written } = await run(args);

        expect(code).toBe(1);
        expect(error.join('\n')).toContain('Usage: npm run load-lineup');
        expect(createStripe).not.toHaveBeenCalled();
        expect(written).toEqual([]);
      },
    );
  });

  describe('a lineup it will not send', () => {
    it('lists every problem with an invalid lineup, and writes and sends nothing', async () => {
      const { code, written, error, stripe } = await run([], {
        lineup: lineupOf(tea({ name: '' }), coffee({ variants: [] })),
      });

      expect(code).toBe(1);
      expect(written).toEqual([]);
      const text = error.join('\n');
      expect(text).toContain('The lineup has 2 problems, so nothing was sent to Stripe');
      expect(text).toContain('jasmine-dream: name is required');
      expect(text).toContain('npm run lineup:csv');
      expect(text).not.toContain('Stripe reported a problem');
      expect(totalCalls(stripe)).toBe(0);
    });

    it('refuses the template example products, and writes and sends nothing', async () => {
      const { code, written, error, stripe } = await run([], {
        lineup: lineupOf(tea({ slug: 'example-green-tea', name: 'Example Green Tea' })),
      });

      expect(code).toBe(1);
      expect(written).toEqual([]);
      expect(error.join('\n')).toContain('example-green-tea');
      expect(error.join('\n')).toContain('Nothing was sent to Stripe');
      expect(error.join('\n')).not.toContain('Stripe reported a problem');
      expect(totalCalls(stripe)).toBe(0);
    });

    it('refuses an empty lineup, which has nothing to send', async () => {
      const { code, written, error, createStripe } = await run([], { lineup: { products: [] } });

      expect(code).toBe(1);
      expect(written).toEqual([]);
      expect(error.join('\n')).toContain('has no products');
      expect(error.join('\n')).toContain('npm run lineup:csv');
      expect(createStripe).not.toHaveBeenCalled();
    });

    it('says so and exits 1 when lineup.json cannot be read', async () => {
      const readText = () => {
        throw new Error('ENOENT: no such file or directory');
      };
      const { code, written, error, createStripe } = await run([], { readText });

      expect(code).toBe(1);
      expect(written).toEqual([]);
      expect(error.join('\n')).toContain('Could not read src/data/lineup.json: ENOENT');
      expect(createStripe).not.toHaveBeenCalled();
    });

    it('says so and exits 1 when lineup.json is not valid JSON', async () => {
      const { code, written, error, createStripe } = await run([], { lineup: '{ "products": [' });

      expect(code).toBe(1);
      expect(written).toEqual([]);
      expect(error.join('\n')).toContain('Could not read src/data/lineup.json');
      expect(createStripe).not.toHaveBeenCalled();
    });
  });

  describe('when something goes wrong with Stripe', () => {
    it('stops and says nothing changed when two Stripe products share a slug', async () => {
      const stripe = fakeStripe({
        products: [stripeProduct({ id: 'prod_a' }), stripeProduct({ id: 'prod_b' })],
      });
      const { code, written, error } = await run([], { stripe });

      expect(code).toBe(1);
      expect(written).toEqual([]);
      expect(error.join('\n')).toContain("Stripe has 2 products with the slug 'jasmine-dream'");
      expect(error.join('\n')).not.toContain('Stripe reported a problem');
      expect(changesMade(stripe)).toBe(0);
    });

    it('explains a Stripe error found while reading, and writes nothing', async () => {
      const stripe = fakeStripe();
      stripe.products.search.mockRejectedValue(new Error('Invalid API Key provided'));
      const { code, written, error } = await run([], { stripe });

      expect(code).toBe(1);
      expect(written).toEqual([]);
      expect(error.join('\n')).toContain('Stripe reported a problem: Invalid API Key provided');
      expect(error.join('\n')).toContain('Nothing was changed');
    });

    it('still explains a failure that is not an Error object', async () => {
      const stripe = fakeStripe();
      stripe.products.search.mockRejectedValue('socket hang up');
      const { code, written, error } = await run([], { stripe });

      expect(code).toBe(1);
      expect(written).toEqual([]);
      expect(error.join('\n')).toContain('Stripe reported a problem: socket hang up');
    });

    it('saves the price ids made before a failure, and tells you to run it again', async () => {
      const stripe = fakeStripe();
      stripe.products.create
        .mockResolvedValueOnce({ id: 'prod_ok' })
        .mockRejectedValueOnce(new Error('Stripe is down'));
      const { code, written, log, error } = await run([], {
        lineup: lineupOf(tea(), coffee()),
        stripe,
      });

      expect(code).toBe(1);
      expect(written).toHaveLength(1);
      expect(JSON.parse(written[0]).products.map(idsOf)).toEqual([
        ['price_new_1', 'price_new_2'],
        [undefined],
      ]);
      expect(log).toContain('Jasmine Dream, 2 oz tin: created price_new_1 ($12.50).');
      const text = error.join('\n');
      expect(text).toContain('Stripe reported a problem: Stripe is down');
      expect(text).toContain('were saved to src/data/lineup.json');
      expect(text).toContain('run this again');
    });

    it('writes nothing when the failure came before any price was made', async () => {
      const stripe = fakeStripe();
      stripe.products.create.mockRejectedValue(new Error('Stripe is down'));
      const { code, written, error } = await run([], { stripe });

      expect(code).toBe(1);
      expect(written).toEqual([]);
      expect(error.join('\n')).toContain('Stripe reported a problem: Stripe is down');
      expect(error.join('\n')).toContain('Nothing was written');
    });

    it('says so, with the report already printed, when lineup.json cannot be written', async () => {
      const writeText = () => {
        throw new Error('EBUSY: resource busy or locked');
      };
      const { code, log, error } = await run([], { writeText });

      expect(code).toBe(1);
      expect(log).toContain('Jasmine Dream, 2 oz tin: created price_new_1 ($12.50).');
      const text = error.join('\n');
      expect(text).toContain('Could not write src/data/lineup.json: EBUSY');
      expect(text).toContain('not saved');
    });
  });
});

// ---- Running the file directly ----------------------------------------------

describe('running scripts/load-lineup.js', () => {
  it('runs the command, which without a Stripe key stops before doing anything', () => {
    const script = fileURLToPath(new URL('./load-lineup.js', import.meta.url));
    // No --env-file, and the key is blanked, so this can never reach Stripe.
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, STRIPE_SECRET_KEY: '' },
    });

    expect(result.stderr).toContain('STRIPE_SECRET_KEY is not set');
    expect(result.status).toBe(1);
  });
});
