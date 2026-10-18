import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler, { buildLineItems, shippingOptions, CheckoutError } from './checkout.js';
import { FREE_SHIPPING_CENTS, FLAT_SHIPPING_CENTS } from '../lib/store-config.js';

// No test here can reach Stripe. The stripe module is replaced by a fake whose
// only method is checkout.sessions.create, and `Stripe` itself is a spy so the
// tests can see whether, and with which key, the handler built a client.
const stripe = vi.hoisted(() => {
  const createSession = vi.fn();
  // A plain function, not an arrow function, because the handler calls it with `new`.
  const Stripe = vi.fn(function () {
    this.checkout = { sessions: { create: createSession } };
  });
  return { Stripe, createSession };
});
vi.mock('stripe', () => ({ default: stripe.Stripe }));

// A small lineup stands in for src/data/lineup.json, which is empty until the
// first real lineup is loaded. checkout.js reads its catalog through this.
vi.mock('../src/data/lineup.json', () => ({
  default: {
    products: [
      {
        slug: 'jasmine-dream',
        name: 'Jasmine Dream',
        category: 'tea',
        variants: [
          {
            id: 'loose-leaf-2oz',
            format: 'loose-leaf',
            size_label: '2 oz tin',
            price_cents: 1250,
            stripe_price_id: 'price_jasmine_tin',
          },
          // In the lineup but never synced to Stripe, so it cannot be sold.
          { id: 'tea-bags-20ct', format: 'tea-bags', size_label: '20 bags', price_cents: 900 },
          // A blank price id means "not synced" too.
          {
            id: 'tea-bags-40ct',
            format: 'tea-bags',
            size_label: '40 bags',
            price_cents: 1500,
            stripe_price_id: '',
          },
        ],
      },
      {
        slug: 'house-roast',
        name: 'House Roast',
        category: 'coffee',
        variants: [
          {
            id: 'whole-bean-12oz',
            format: 'whole-bean',
            size_label: '12 oz bag',
            price_cents: 1600,
            stripe_price_id: 'price_house_bag',
          },
        ],
      },
    ],
  },
}));

const ORIGIN = 'https://siphaven.com';
const SESSION_URL = 'https://checkout.stripe.test/session';

// Cart lines as the browser sends them.
const tin = (qty) => ({ slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty });
const bag = (qty) => ({ slug: 'house-roast', variantId: 'whole-bean-12oz', qty });

// Run the handler once and hand back what it answered.
async function post(body, { method = 'POST', headers = { origin: ORIGIN } } = {}) {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  await handler({ method, headers, body }, res);
  return res;
}

// The parameters the handler gave Stripe on its one session-create call.
const sessionParams = () => stripe.createSession.mock.calls[0][0];

// Keeps an expected server-side log line out of the test output.
const silenceErrorLog = () => vi.spyOn(console, 'error').mockImplementation(() => {});

// The error a function throws. Fails the test if it does not throw.
function thrownBy(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the function to throw');
}

beforeEach(() => {
  vi.stubEnv('STORE_OPEN', 'true');
  vi.stubEnv('VITE_STORE_OPEN', undefined);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
  stripe.Stripe.mockReset();
  stripe.createSession.mockReset();
  stripe.createSession.mockResolvedValue({ url: SESSION_URL });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CheckoutError', () => {
  it('is an Error whose message is safe to show the shopper', () => {
    const error = new CheckoutError('That item is no longer available.');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CheckoutError');
    expect(error.message).toBe('That item is no longer available.');
  });
});

describe('buildLineItems', () => {
  it('maps lines to Stripe line items and totals the lineup prices', () => {
    expect(buildLineItems([tin(2), bag(1)])).toEqual({
      line_items: [
        { price: 'price_jasmine_tin', quantity: 2 },
        { price: 'price_house_bag', quantity: 1 },
      ],
      subtotal_cents: 2 * 1250 + 1 * 1600,
    });
  });

  it('keeps the lines in the order they were sent', () => {
    const { line_items } = buildLineItems([bag(1), tin(1)]);
    expect(line_items.map((line) => line.price)).toEqual(['price_house_bag', 'price_jasmine_tin']);
  });

  it('takes the price from the lineup, never from the browser', () => {
    const cheat = { ...tin(1), price: 'price_other', price_cents: 1, unit_amount: 1 };
    expect(buildLineItems([cheat])).toEqual({
      line_items: [{ price: 'price_jasmine_tin', quantity: 1 }],
      subtotal_cents: 1250,
    });
  });

  it.each([1, 20])('accepts a quantity of %i', (qty) => {
    const { line_items } = buildLineItems([tin(qty)]);
    expect(line_items).toEqual([{ price: 'price_jasmine_tin', quantity: qty }]);
  });

  it.each([
    ['0', 0],
    ['21', 21],
    ['1.5', 1.5],
    ["the text '2'", '2'],
    ['-1', -1],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['null', null],
    ['nothing at all', undefined],
    ['true', true],
  ])('rejects a quantity of %s', (_description, qty) => {
    const error = thrownBy(() => buildLineItems([tin(qty)]));
    expect(error).toBeInstanceOf(CheckoutError);
    expect(error.message).toBe('Quantity must be between 1 and 20.');
  });

  it.each([
    ['an unknown product', { slug: 'nope', variantId: 'loose-leaf-2oz', qty: 1 }],
    ['an unknown variant of a real product', { slug: 'jasmine-dream', variantId: 'nope', qty: 1 }],
    [
      "another product's variant id",
      { slug: 'jasmine-dream', variantId: 'whole-bean-12oz', qty: 1 },
    ],
    [
      'a variant that is not synced to Stripe',
      { slug: 'jasmine-dream', variantId: 'tea-bags-20ct', qty: 1 },
    ],
    [
      'a variant whose stripe_price_id is blank',
      { slug: 'jasmine-dream', variantId: 'tea-bags-40ct', qty: 1 },
    ],
    ['a line with no slug or variant', { qty: 1 }],
    ['a slug that is not text', { slug: ['jasmine-dream'], variantId: 'loose-leaf-2oz', qty: 1 }],
    ['a line that is not an object', null],
    ['a line that is just text', 'jasmine-dream'],
  ])('rejects %s as no longer available', (_description, line) => {
    const error = thrownBy(() => buildLineItems([line]));
    expect(error).toBeInstanceOf(CheckoutError);
    expect(error.message).toBe('That item is no longer available.');
  });

  it('does not sell part of a cart: one bad line rejects all of it', () => {
    const error = thrownBy(() =>
      buildLineItems([tin(1), { slug: 'nope', variantId: 'x', qty: 1 }, bag(1)]),
    );
    expect(error).toBeInstanceOf(CheckoutError);
    expect(error.message).toBe('That item is no longer available.');
  });
});

describe('shippingOptions', () => {
  const flat = [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: 'Standard shipping',
        fixed_amount: { amount: FLAT_SHIPPING_CENTS, currency: 'usd' },
        tax_behavior: 'exclusive',
      },
    },
  ];
  const free = [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: 'Free shipping',
        fixed_amount: { amount: 0, currency: 'usd' },
        tax_behavior: 'exclusive',
      },
    },
  ];

  // With the placeholder settings these are 4999 and 5000 cents.
  it('charges the flat rate one cent under the free-shipping threshold', () => {
    expect(shippingOptions(FREE_SHIPPING_CENTS - 1)).toEqual(flat);
  });

  it('is free at exactly the free-shipping threshold', () => {
    expect(shippingOptions(FREE_SHIPPING_CENTS)).toEqual(free);
  });

  it('is free above the threshold', () => {
    expect(shippingOptions(FREE_SHIPPING_CENTS * 3)).toEqual(free);
  });

  it('charges the flat rate for a tiny or empty subtotal', () => {
    expect(shippingOptions(1)).toEqual(flat);
    expect(shippingOptions(0)).toEqual(flat);
  });

  it('offers exactly one rate, in US dollars, with no delivery-time promise', () => {
    for (const options of [shippingOptions(0), shippingOptions(FREE_SHIPPING_CENTS)]) {
      expect(options).toHaveLength(1);
      const rate = options[0].shipping_rate_data;
      expect(rate.fixed_amount.currency).toBe('usd');
      expect(rate).not.toHaveProperty('delivery_estimate');
    }
  });
});

describe('POST /api/checkout', () => {
  it.each(['GET', 'PUT', 'DELETE'])('answers a %s request with 405', async (method) => {
    const res = await post({ items: [tin(1)] }, { method });
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it('rejects when store closed', async () => {
    vi.stubEnv('STORE_OPEN', undefined);
    const res = await post({ items: [tin(1)] });
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Store is not open yet.' });
    expect(stripe.Stripe).not.toHaveBeenCalled();
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it.each([
    ['no body', undefined],
    ['an empty cart', { items: [] }],
    ['a cart with a bad line', { items: [{ slug: 'nope', variantId: 'x', qty: 0 }] }],
  ])('does not look at the cart while the store is closed: %s', async (_description, body) => {
    vi.stubEnv('STORE_OPEN', 'false');
    const res = await post(body);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Store is not open yet.' });
  });

  it.each([
    ['no body', undefined],
    ['a null body', null],
    ['a body with no items', {}],
    ['items that are not a list', { items: 'tea' }],
    ['an empty list of items', { items: [] }],
  ])('rejects %s with 400', async (_description, body) => {
    const res = await post(body);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'No items provided' });
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it.each([
    ['0', 0],
    ['21', 21],
    ['1.5', 1.5],
    ["the text '2'", '2'],
  ])('rejects a quantity of %s with 400 and never reaches Stripe', async (_description, qty) => {
    const res = await post({ items: [tin(qty)] });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Quantity must be between 1 and 20.' });
    expect(stripe.Stripe).not.toHaveBeenCalled();
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown product', { slug: 'nope', variantId: 'x', qty: 1 }],
    ['an unknown variant', { slug: 'jasmine-dream', variantId: 'nope', qty: 1 }],
    [
      'a variant that is not synced to Stripe',
      { slug: 'jasmine-dream', variantId: 'tea-bags-20ct', qty: 1 },
    ],
  ])('rejects %s with 400 and never reaches Stripe', async (_description, line) => {
    const res = await post({ items: [tin(1), line] });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'That item is no longer available.' });
    expect(stripe.Stripe).not.toHaveBeenCalled();
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it('creates a Checkout Session from the lineup and returns its url', async () => {
    const res = await post({ items: [tin(2), bag(1)] });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ url: SESSION_URL });
    expect(stripe.Stripe).toHaveBeenCalledWith('sk_test_fake');
    expect(stripe.createSession).toHaveBeenCalledTimes(1);
    expect(sessionParams()).toEqual({
      mode: 'payment',
      line_items: [
        { price: 'price_jasmine_tin', quantity: 2 },
        { price: 'price_house_bag', quantity: 1 },
      ],
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ['US'] },
      shipping_options: shippingOptions(2 * 1250 + 1 * 1600),
      success_url: 'https://siphaven.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://siphaven.com/cart',
    });
  });

  it('asks Stripe for automatic tax and promotion codes', async () => {
    await post({ items: [tin(1)] });
    expect(sessionParams().automatic_tax.enabled).toBe(true);
    expect(sessionParams().allow_promotion_codes).toBe(true);
  });

  it('only ever sells to the United States', async () => {
    await post({ items: [tin(1)] });
    expect(sessionParams().shipping_address_collection).toEqual({ allowed_countries: ['US'] });
  });

  it('sends the shopper back to the site they came from', async () => {
    await post({ items: [tin(1)] }, { headers: { origin: 'https://preview.siphaven.test' } });
    expect(sessionParams().success_url).toBe(
      'https://preview.siphaven.test/success?session_id={CHECKOUT_SESSION_ID}',
    );
    expect(sessionParams().cancel_url).toBe('https://preview.siphaven.test/cart');
  });

  it('falls back to the local dev server when the request has no Origin header', async () => {
    await post({ items: [tin(1)] }, { headers: {} });
    expect(sessionParams().success_url).toBe(
      'http://localhost:5174/success?session_id={CHECKOUT_SESSION_ID}',
    );
    expect(sessionParams().cancel_url).toBe('http://localhost:5174/cart');
  });

  it('charges flat shipping on a small cart', async () => {
    await post({ items: [tin(1)] });
    const rate = sessionParams().shipping_options[0].shipping_rate_data;
    expect(rate.display_name).toBe('Standard shipping');
    expect(rate.fixed_amount.amount).toBe(FLAT_SHIPPING_CENTS);
  });

  it('ships a big cart free', async () => {
    await post({ items: [tin(20)] });
    const rate = sessionParams().shipping_options[0].shipping_rate_data;
    expect(rate.display_name).toBe('Free shipping');
    expect(rate.fixed_amount.amount).toBe(0);
  });

  it('hides a Stripe failure behind a generic 500 and logs the real error', async () => {
    const log = silenceErrorLog();
    const failure = new Error('No such price: price_jasmine_tin');
    stripe.createSession.mockRejectedValue(failure);

    const res = await post({ items: [tin(1)] });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Payment session could not be created.' });
    expect(JSON.stringify(res.body)).not.toContain('price_jasmine_tin');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toContain(failure);
  });

  it('gives the same generic 500 when the Stripe client cannot be created', async () => {
    const log = silenceErrorLog();
    const failure = new Error('Neither apiKey nor config.authenticator provided');
    vi.stubEnv('STRIPE_SECRET_KEY', undefined);
    stripe.Stripe.mockImplementationOnce(function () {
      throw failure;
    });

    const res = await post({ items: [tin(1)] });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Payment session could not be created.' });
    expect(stripe.createSession).not.toHaveBeenCalled();
    expect(log.mock.calls[0]).toContain(failure);
  });

  it('treats a session that comes back without a url as a failure', async () => {
    const log = silenceErrorLog();
    stripe.createSession.mockResolvedValue({ id: 'cs_test_1', url: null });

    const res = await post({ items: [tin(1)] });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Payment session could not be created.' });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('does not leak an unexpected error from the cart check', async () => {
    const log = silenceErrorLog();
    const broken = {
      get slug() {
        throw new Error('internal detail');
      },
      variantId: 'loose-leaf-2oz',
      qty: 1,
    };

    const res = await post({ items: [broken] });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Payment session could not be created.' });
    expect(JSON.stringify(res.body)).not.toContain('internal detail');
    expect(stripe.Stripe).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });
});
