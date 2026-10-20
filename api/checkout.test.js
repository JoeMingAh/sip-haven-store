import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler, {
  buildLineItems,
  shippingOptions,
  returnOrigin,
  CheckoutError,
} from './checkout.js';
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
          // So does one with nothing in it but spaces.
          {
            id: 'tea-bags-60ct',
            format: 'tea-bags',
            size_label: '60 bags',
            price_cents: 2000,
            stripe_price_id: '   ',
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

// The site's own address (SITE_URL), and the Origin a shopper on the site posts from.
const SITE_URL = 'https://siphaven.com';
const ORIGIN = SITE_URL;
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
  vi.stubEnv('SITE_URL', SITE_URL);
  vi.stubEnv('VERCEL_URL', undefined);
  vi.stubEnv('VERCEL_ENV', undefined);
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
    [
      'a variant whose stripe_price_id is only spaces',
      { slug: 'jasmine-dream', variantId: 'tea-bags-60ct', qty: 1 },
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

describe('returnOrigin', () => {
  const DEPLOYMENT = 'sip-haven-store-abc123.vercel.app';

  it('uses the request Origin when it is SITE_URL', () => {
    expect(returnOrigin(SITE_URL)).toBe(SITE_URL);
  });

  it("uses the request Origin when it is this deployment's own address (VERCEL_URL)", () => {
    vi.stubEnv('VERCEL_URL', DEPLOYMENT);
    expect(returnOrigin(`https://${DEPLOYMENT}`)).toBe(`https://${DEPLOYMENT}`);
  });

  it.each([undefined, 'preview', 'development'])(
    'uses a localhost Origin with a port when VERCEL_ENV is %s',
    (env) => {
      vi.stubEnv('VERCEL_ENV', env);
      expect(returnOrigin('http://localhost:5174')).toBe('http://localhost:5174');
      expect(returnOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    },
  );

  it('does not use a localhost Origin in production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(returnOrigin('http://localhost:5174')).toBe(SITE_URL);
  });

  it('still uses SITE_URL and this deployment in production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_URL', DEPLOYMENT);
    expect(returnOrigin(SITE_URL)).toBe(SITE_URL);
    expect(returnOrigin(`https://${DEPLOYMENT}`)).toBe(`https://${DEPLOYMENT}`);
  });

  it.each([
    ['another site', 'https://evil.example'],
    ['a site whose name begins with SITE_URL', 'https://siphaven.com.evil.example'],
    ['a subdomain of the site', 'https://shop.siphaven.com'],
    ['the site on another port', 'https://siphaven.com:8443'],
    ['the site over http', 'http://siphaven.com'],
    ['the site with a path', 'https://siphaven.com/cart'],
    ['the site with a trailing slash', 'https://siphaven.com/'],
    ['localhost with no port', 'http://localhost'],
    ['localhost over https', 'https://localhost:5174'],
    ['localhost with a path', 'http://localhost:5174/cart'],
    ['a longer host that begins like localhost', 'http://localhost:5174.evil.example'],
    ['a host that ends in localhost', 'http://evil-localhost:5174'],
    ['a localhost port that is not a number', 'http://localhost:abc'],
    ['127.0.0.1', 'http://127.0.0.1:5174'],
    ['the text "null" that a browser sends from a sandboxed page', 'null'],
    ['no Origin at all', undefined],
    ['an empty Origin', ''],
    ['an Origin that is not text', [SITE_URL]],
  ])('uses SITE_URL itself, not the request Origin, for %s', (_description, requestOrigin) => {
    expect(returnOrigin(requestOrigin)).toBe(SITE_URL);
  });

  it('does not take "https://undefined" for this deployment when VERCEL_URL is not set', () => {
    // Without the check, `https://${undefined}` would be a trusted origin.
    expect(returnOrigin('https://undefined')).toBe(SITE_URL);
  });

  it('does not trust this deployment over another scheme or port', () => {
    vi.stubEnv('VERCEL_URL', DEPLOYMENT);
    expect(returnOrigin(`http://${DEPLOYMENT}`)).toBe(SITE_URL);
    expect(returnOrigin(`https://${DEPLOYMENT}:8443`)).toBe(SITE_URL);
    expect(returnOrigin(`https://other-${DEPLOYMENT}`)).toBe(SITE_URL);
  });

  it('ignores a trailing slash on SITE_URL, which an Origin never has', () => {
    vi.stubEnv('SITE_URL', 'https://siphaven.com/');
    expect(returnOrigin('https://siphaven.com')).toBe('https://siphaven.com');
    expect(returnOrigin('https://evil.example')).toBe('https://siphaven.com');
  });

  describe('when SITE_URL is not set', () => {
    it.each([
      ['unset', undefined],
      ['blank', ''],
      ['only spaces', '   '],
    ])('throws, naming SITE_URL, for an Origin that is not allowed (SITE_URL %s)', (_case, value) => {
      vi.stubEnv('SITE_URL', value);
      expect(() => returnOrigin('https://evil.example')).toThrow(/SITE_URL/);
      expect(() => returnOrigin(undefined)).toThrow(/SITE_URL/);
      expect(() => returnOrigin('')).toThrow(/SITE_URL/);
    });

    it('does not use a localhost Origin in production either', () => {
      vi.stubEnv('SITE_URL', undefined);
      vi.stubEnv('VERCEL_ENV', 'production');
      expect(() => returnOrigin('http://localhost:5174')).toThrow(/SITE_URL/);
    });

    it('still uses an Origin that is allowed without it: this deployment, or localhost', () => {
      vi.stubEnv('SITE_URL', undefined);
      vi.stubEnv('VERCEL_URL', DEPLOYMENT);
      expect(returnOrigin(`https://${DEPLOYMENT}`)).toBe(`https://${DEPLOYMENT}`);
      expect(returnOrigin('http://localhost:5174')).toBe('http://localhost:5174');
    });
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
    [
      'a variant whose stripe_price_id is only spaces',
      { slug: 'jasmine-dream', variantId: 'tea-bags-60ct', qty: 1 },
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

  describe('where Stripe sends the shopper back to', () => {
    // The Origin header is whatever the caller says it is, so success_url and cancel_url
    // are only built from it when it names a place this site is served from.
    const urls = () => [sessionParams().success_url, sessionParams().cancel_url];
    const SUCCESS = (base) => `${base}/success?session_id={CHECKOUT_SESSION_ID}`;
    const CART = (base) => `${base}/cart`;

    it('is the site the shopper came from, when that is SITE_URL', async () => {
      await post({ items: [tin(1)] }, { headers: { origin: SITE_URL } });
      expect(urls()).toEqual([SUCCESS(SITE_URL), CART(SITE_URL)]);
    });

    it('is this preview deployment when the shopper came from it', async () => {
      const deployment = 'https://sip-haven-store-abc123.vercel.app';
      vi.stubEnv('VERCEL_URL', 'sip-haven-store-abc123.vercel.app');
      await post({ items: [tin(1)] }, { headers: { origin: deployment } });
      expect(urls()).toEqual([SUCCESS(deployment), CART(deployment)]);
    });

    it('is a localhost address with a port when the shopper came from one outside production', async () => {
      vi.stubEnv('VERCEL_ENV', 'development');
      await post({ items: [tin(1)] }, { headers: { origin: 'http://localhost:5174' } });
      expect(urls()).toEqual([SUCCESS('http://localhost:5174'), CART('http://localhost:5174')]);
    });

    it('is SITE_URL, not a localhost address, in production', async () => {
      vi.stubEnv('VERCEL_ENV', 'production');
      await post({ items: [tin(1)] }, { headers: { origin: 'http://localhost:5174' } });
      expect(urls()).toEqual([SUCCESS(SITE_URL), CART(SITE_URL)]);
    });

    it.each([
      ['another site', 'https://evil.example'],
      ['a lookalike of the site', 'https://siphaven.com.evil.example'],
      ['localhost with no port', 'http://localhost'],
    ])('is SITE_URL, never the Origin, for %s', async (_description, origin) => {
      const res = await post({ items: [tin(1)] }, { headers: { origin } });
      expect(res.statusCode).toBe(200);
      expect(urls()).toEqual([SUCCESS(SITE_URL), CART(SITE_URL)]);
      expect(JSON.stringify(sessionParams())).not.toContain('evil');
    });

    it('is SITE_URL when the request has no Origin header', async () => {
      const res = await post({ items: [tin(1)] }, { headers: {} });
      expect(res.statusCode).toBe(200);
      expect(urls()).toEqual([SUCCESS(SITE_URL), CART(SITE_URL)]);
    });

    it('is the localhost address, with no SITE_URL set, when the shopper came from one', async () => {
      vi.stubEnv('SITE_URL', undefined);
      const res = await post({ items: [tin(1)] }, { headers: { origin: 'http://localhost:5174' } });
      expect(res.statusCode).toBe(200);
      expect(urls()).toEqual([SUCCESS('http://localhost:5174'), CART('http://localhost:5174')]);
    });

    it.each([
      ['an Origin that is not allowed', { origin: 'https://evil.example' }],
      ['no Origin header', {}],
    ])('answers 500 and logs the missing SITE_URL when it is unset and there is %s', async (_description, headers) => {
      const log = silenceErrorLog();
      vi.stubEnv('SITE_URL', undefined);

      const res = await post({ items: [tin(1)] }, { headers });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Payment session could not be created.' });
      expect(JSON.stringify(res.body)).not.toContain('SITE_URL');
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][1].message).toMatch(/SITE_URL/);
      expect(stripe.Stripe).not.toHaveBeenCalled();
      expect(stripe.createSession).not.toHaveBeenCalled();
    });

    it('answers 500 for a localhost Origin in production when SITE_URL is unset', async () => {
      silenceErrorLog();
      vi.stubEnv('SITE_URL', undefined);
      vi.stubEnv('VERCEL_ENV', 'production');

      const res = await post({ items: [tin(1)] }, { headers: { origin: 'http://localhost:5174' } });

      expect(res.statusCode).toBe(500);
      expect(stripe.createSession).not.toHaveBeenCalled();
    });

    it('still turns a bad cart away with 400 first when SITE_URL is unset', async () => {
      vi.stubEnv('SITE_URL', undefined);
      const res = await post({ items: [tin(0)] }, { headers: {} });
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Quantity must be between 1 and 20.' });
    });
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
