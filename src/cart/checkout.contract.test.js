// The browser's side of checkout (src/cart) talking to the real /api/checkout handler.
// api/checkout.test.js covers the handler on its own and checkout.test.js, beside this
// file, covers the browser on its own; this checks that they agree: what the cart sends
// is what the handler reads, the quantities the cart allows are the ones the handler
// accepts, and the words the handler answers with are the words the shopper is shown.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../api/checkout.js';
import { startCheckout } from './checkout.js';
import { addLine, setLineQty } from './cartLines.js';
import { MAX_QTY } from '../../lib/store-config.js';

// No test here can reach Stripe: a fake takes the place of the stripe module.
const stripe = vi.hoisted(() => {
  const createSession = vi.fn();
  const Stripe = vi.fn(function () {
    this.checkout = { sessions: { create: createSession } };
  });
  return { Stripe, createSession };
});
vi.mock('stripe', () => ({ default: stripe.Stripe }));

// A small lineup stands in for src/data/lineup.json. The handler and the cart both
// read their catalog through it.
vi.mock('../data/lineup.json', () => ({
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
          // In the lineup but not synced to Stripe, so it cannot be sold.
          { id: 'tea-bags-20ct', format: 'tea-bags', size_label: '20 bags', price_cents: 900 },
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
          {
            id: 'ground-12oz',
            format: 'ground',
            size_label: '12 oz bag',
            price_cents: 1600,
            stripe_price_id: 'price_house_ground',
          },
        ],
      },
    ],
  },
}));

const SESSION_URL = 'https://checkout.stripe.test/session';

// fetch, answered by the real handler instead of the network.
async function fetchViaHandler(url, init) {
  expect(url).toBe('/api/checkout');
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  await handler(
    { method: init.method, headers: { origin: 'https://siphaven.com' }, body: JSON.parse(init.body) },
    res,
  );
  return {
    ok: res.statusCode >= 200 && res.statusCode < 300,
    status: res.statusCode,
    json: async () => res.body,
  };
}

beforeEach(() => {
  vi.stubEnv('STORE_OPEN', 'true');
  vi.stubEnv('VITE_STORE_OPEN', undefined);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
  // The handler only sends a shopper back to the site it is configured for.
  vi.stubEnv('SITE_URL', 'https://siphaven.com');
  stripe.Stripe.mockReset();
  stripe.createSession.mockReset();
  stripe.createSession.mockResolvedValue({ url: SESSION_URL });
  vi.stubGlobal('fetch', vi.fn(fetchViaHandler));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const line = (slug, variantId, qty) => ({ slug, variantId, qty });

describe('the cart and /api/checkout', () => {
  it('a cart goes through, and the shopper is sent where Stripe says', async () => {
    const result = await startCheckout([
      line('jasmine-dream', 'loose-leaf-2oz', 2),
      line('house-roast', 'ground-12oz', 1),
    ]);

    expect(result).toEqual({ url: SESSION_URL });
    // Priced from the lineup: the handler gave Stripe the price ids, never prices from the browser.
    expect(stripe.createSession.mock.calls[0][0].line_items).toEqual([
      { price: 'price_jasmine_tin', quantity: 2 },
      { price: 'price_house_ground', quantity: 1 },
    ]);
  });

  it('keeps the grind: whole bean and ground are different prices at Stripe', async () => {
    await startCheckout([line('house-roast', 'whole-bean-12oz', 1), line('house-roast', 'ground-12oz', 1)]);
    expect(stripe.createSession.mock.calls[0][0].line_items.map((item) => item.price)).toEqual([
      'price_house_bag',
      'price_house_ground',
    ]);
  });

  it('never builds a quantity the handler turns away: adding past the cap stops at the cap', async () => {
    let lines = addLine([], 'jasmine-dream', 'loose-leaf-2oz', 15);
    lines = addLine(lines, 'jasmine-dream', 'loose-leaf-2oz', 15);
    expect(lines[0].qty).toBe(MAX_QTY);

    await expect(startCheckout(lines)).resolves.toEqual({ url: SESSION_URL });
    expect(stripe.createSession.mock.calls[0][0].line_items).toEqual([
      { price: 'price_jasmine_tin', quantity: MAX_QTY },
    ]);
  });

  it('nor one set by a stepper: 1 and the cap both go through', async () => {
    const start = addLine([], 'jasmine-dream', 'loose-leaf-2oz', 5);
    for (const qty of [0, 1, MAX_QTY, 99]) {
      stripe.createSession.mockClear();
      const lines = setLineQty(start, 'jasmine-dream', 'loose-leaf-2oz', qty);
      await expect(startCheckout(lines)).resolves.toEqual({ url: SESSION_URL });
    }
  });

  it('shows the handler\'s words when a variant is gone: "That item is no longer available."', async () => {
    const result = await startCheckout([line('jasmine-dream', 'loose-leaf-9lb', 1)]);
    expect(result).toEqual({ error: 'That item is no longer available.' });
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it('says the same for a variant that was never synced to Stripe', async () => {
    const result = await startCheckout([line('jasmine-dream', 'tea-bags-20ct', 1)]);
    expect(result).toEqual({ error: 'That item is no longer available.' });
  });

  it("shows the handler's words for a bad quantity", async () => {
    const result = await startCheckout([line('jasmine-dream', 'loose-leaf-2oz', MAX_QTY + 1)]);
    expect(result).toEqual({ error: `Quantity must be between 1 and ${MAX_QTY}.` });
  });

  it('shows the handler\'s words while the store is closed: "Store is not open yet."', async () => {
    vi.stubEnv('STORE_OPEN', 'false');
    const result = await startCheckout([line('jasmine-dream', 'loose-leaf-2oz', 1)]);
    expect(result).toEqual({ error: 'Store is not open yet.' });
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it("shows the handler's words when Stripe fails, and not Stripe's own", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stripe.createSession.mockRejectedValue(new Error('No such price: price_secret_detail'));
    const result = await startCheckout([line('jasmine-dream', 'loose-leaf-2oz', 1)]);
    expect(result).toEqual({ error: 'Payment session could not be created.' });
  });
});
