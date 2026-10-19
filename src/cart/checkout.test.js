import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startCheckout } from './checkout.js';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const STRIPE_URL = 'https://checkout.stripe.com/c/pay/cs_test_abc123';

// What /api/checkout answers with: 200 { url }, or 400 / 403 / 500 { error }.
const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const LINES = [
  { slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 2 },
  { slug: 'dawn-roast', variantId: 'ground-12oz', qty: 1 },
];

describe('startCheckout: what it sends', () => {
  it('posts { items: [{ slug, variantId, qty }] } as JSON to /api/checkout', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    await startCheckout(LINES);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/checkout');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({
      items: [
        { slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 2 },
        { slug: 'dawn-roast', variantId: 'ground-12oz', qty: 1 },
      ],
    });
  });

  it('sends exactly those three fields per item and nothing else', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    await startCheckout([{ slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 2, price_cents: 1, name: 'x' }]);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(body)).toEqual(['items']);
    expect(Object.keys(body.items[0]).sort()).toEqual(['qty', 'slug', 'variantId']);
  });
});

describe('startCheckout: success', () => {
  it('gives back the url to send the shopper to', async () => {
    fetchMock.mockResolvedValue(reply(200, { url: STRIPE_URL }));
    await expect(startCheckout(LINES)).resolves.toEqual({ url: STRIPE_URL });
  });
});

describe('startCheckout: the server says no', () => {
  it.each([
    [400, 'That item is no longer available.'],
    [400, 'Quantity must be between 1 and 20.'],
    [403, 'Store is not open yet.'],
    [500, 'Payment session could not be created.'],
  ])("gives back the server's own words for a %i: %s", async (status, error) => {
    fetchMock.mockResolvedValue(reply(status, { error }));
    await expect(startCheckout(LINES)).resolves.toEqual({ error });
  });

  it.each([
    ['an empty body', reply(500, {})],
    ['a null body', reply(500, null)],
    ['a blank error', reply(400, { error: '   ' })],
    ['an error that is not text', reply(400, { error: { code: 1 } })],
    [
      'a body that is not JSON',
      {
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      },
    ],
    ['a response with no json method', { ok: false, status: 500 }],
  ])('falls back to the generic message for %s', async (_name, response) => {
    fetchMock.mockResolvedValue(response);
    await expect(startCheckout(LINES)).resolves.toEqual({ error: GENERIC_ERROR });
  });
});

describe('startCheckout: things that should never happen', () => {
  it('gives the generic message when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(startCheckout(LINES)).resolves.toEqual({ error: GENERIC_ERROR });
  });

  it.each([
    ['a 200 with no url', reply(200, {})],
    ['a 200 with a null body', reply(200, null)],
    ['a 200 with a url that is not text', reply(200, { url: 42 })],
    // A list of one address reads as that address when it is turned into text, so it
    // has to be refused for being a list, not just for not being an address.
    ['a 200 with a url inside a list', reply(200, { url: [STRIPE_URL] })],
    ['a 200 with a url inside an object', reply(200, { url: { href: STRIPE_URL } })],
    ['a 200 with an empty url', reply(200, { url: '' })],
    ['a 200 with a url that is not a web address', reply(200, { url: 'checkout' })],
    ['a 200 with a javascript: url', reply(200, { url: 'javascript:alert(1)' })],
    ['a 200 with a data: url', reply(200, { url: 'data:text/html,<p>hi</p>' })],
    [
      'a 200 whose body is not JSON',
      {
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input');
        },
      },
    ],
  ])('never sends the shopper anywhere for %s', async (_name, response) => {
    fetchMock.mockResolvedValue(response);
    await expect(startCheckout(LINES)).resolves.toEqual({ error: GENERIC_ERROR });
  });

  it('does not take a 4xx that happens to carry a url as a go-ahead', async () => {
    fetchMock.mockResolvedValue(reply(400, { url: STRIPE_URL, error: 'That item is no longer available.' }));
    await expect(startCheckout(LINES)).resolves.toEqual({ error: 'That item is no longer available.' });
  });
});
