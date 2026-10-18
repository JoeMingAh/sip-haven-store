import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler, { buildOrderEmail } from './webhook.js';

// No test here can reach Stripe or Resend. Both modules are replaced by fakes,
// and the fakes' methods are spies so the tests can see what the handler asked.
const stripe = vi.hoisted(() => {
  const constructEvent = vi.fn();
  const retrieveSession = vi.fn();
  const listLineItems = vi.fn();
  // A plain function, not an arrow function, because the handler calls it with `new`.
  const Stripe = vi.fn(function () {
    this.webhooks = { constructEvent };
    this.checkout = { sessions: { retrieve: retrieveSession, listLineItems } };
  });
  return { Stripe, constructEvent, retrieveSession, listLineItems };
});
vi.mock('stripe', () => ({ default: stripe.Stripe }));

const resend = vi.hoisted(() => {
  const sendEmail = vi.fn();
  const Resend = vi.fn(function () {
    this.emails = { send: sendEmail };
  });
  return { Resend, sendEmail };
});
vi.mock('resend', () => ({ Resend: resend.Resend }));

const mockSession = {
  customer_details: {
    name: 'Jane Doe',
    email: 'jane@example.com',
  },
  shipping_details: {
    address: {
      line1: '123 Main St',
      line2: 'Apt 4',
      city: 'Portland',
      state: 'OR',
      postal_code: '97201',
    },
  },
  amount_total: 2500,
  line_items: {
    data: [
      {
        description: "Sipper's Whisper Espresso Blend",
        quantity: 2,
      },
    ],
  },
};

describe('buildOrderEmail', () => {
  it('includes customer name in subject', () => {
    const { subject } = buildOrderEmail(mockSession);
    expect(subject).toBe("New Order — Jane Doe");
  });

  it('includes customer name and email in body', () => {
    const { text } = buildOrderEmail(mockSession);
    expect(text).toContain('Jane Doe');
    expect(text).toContain('jane@example.com');
  });

  it('converts amount from cents to dollars', () => {
    const { text } = buildOrderEmail(mockSession);
    expect(text).toContain('$25.00');
  });

  it('includes full shipping address', () => {
    const { text } = buildOrderEmail(mockSession);
    expect(text).toContain('123 Main St');
    expect(text).toContain('Apt 4');
    expect(text).toContain('Portland, OR 97201');
  });

  it('includes item name and quantity', () => {
    const { text } = buildOrderEmail(mockSession);
    expect(text).toContain("Sipper's Whisper Espresso Blend x2");
  });

  it('shows "No address provided" when shipping_details is null', () => {
    const session = { ...mockSession, shipping_details: null };
    const { text } = buildOrderEmail(session);
    expect(text).toContain('No address provided');
  });

  it('omits line2 from address when null', () => {
    const session = {
      ...mockSession,
      shipping_details: {
        address: {
          line1: '456 Oak Ave',
          line2: null,
          city: 'Seattle',
          state: 'WA',
          postal_code: '98101',
        },
      },
    };
    const { text } = buildOrderEmail(session);
    expect(text).toContain('456 Oak Ave');
    expect(text).toContain('Seattle, WA 98101');
    expect(text).not.toContain('null');
  });

  it('includes all items when multiple are ordered', () => {
    const session = {
      ...mockSession,
      line_items: {
        data: [
          { description: "Sipper's Whisper Espresso Blend", quantity: 1 },
          { description: "Sipper's Murmur – Swiss Water® Decaf", quantity: 2 },
        ],
      },
    };
    const { text } = buildOrderEmail(session);
    expect(text).toContain("Sipper's Whisper Espresso Blend x1");
    expect(text).toContain("Sipper's Murmur – Swiss Water® Decaf x2");
  });
});

// Line items as listLineItems returns them with expand: ['data.price']. The
// description is the product name; the variant id lives in the price metadata.
const tinLine = {
  description: 'Jasmine Dream',
  quantity: 2,
  price: { metadata: { slug: 'jasmine-dream', variant_id: 'loose-leaf-2oz' } },
};
const bagLine = {
  description: 'House Roast',
  quantity: 1,
  price: { metadata: { slug: 'house-roast', variant_id: 'whole-bean-12oz' } },
};

describe('buildOrderEmail items and tax', () => {
  const withLines = (data) => ({ ...mockSession, line_items: { data } });

  it('writes each line as "name (variant id) × quantity" from the price metadata', () => {
    const { text } = buildOrderEmail(withLines([tinLine, bagLine]));
    expect(text).toContain('- Jasmine Dream (loose-leaf-2oz) × 2');
    expect(text).toContain('- House Roast (whole-bean-12oz) × 1');
  });

  it.each([
    ['has no price', null],
    ['has a price with no metadata', {}],
    ['has a price with no variant id', { metadata: { slug: 'gift-card' } }],
  ])('keeps the plain "name xN" form for a line that %s', (_case, price) => {
    const { text } = buildOrderEmail(withLines([{ description: 'Gift card', quantity: 3, price }]));
    expect(text).toContain('- Gift card x3');
    expect(text).not.toContain('undefined');
  });

  it('shows the tax amount from total_details in dollars', () => {
    const { text } = buildOrderEmail({ ...mockSession, total_details: { amount_tax: 206 } });
    expect(text).toContain('Tax: $2.06');
  });

  it.each([
    ['has no total_details', undefined],
    ['has total_details without amount_tax', {}],
    ['has a null amount_tax', { amount_tax: null }],
  ])('shows zero tax when the session %s', (_case, totalDetails) => {
    const { text } = buildOrderEmail({ ...mockSession, total_details: totalDetails });
    expect(text).toContain('Tax: $0.00');
  });

  it.each([
    ['null', null],
    ['missing', undefined],
  ])('says the items could not be loaded when the session line items are %s', (_case, lineItems) => {
    const { text } = buildOrderEmail({ ...mockSession, line_items: lineItems });
    expect(text).toContain('Items could not be loaded');
    // The rest of the order notice is still there.
    expect(text).toContain('Jane Doe');
    expect(text).toContain('123 Main St');
    expect(text).toContain('$25.00');
  });
});

const EVENT_ID = 'evt_test_123';
const SESSION_ID = 'cs_test_123';

// The session as retrieve returns it. Its line items come from listLineItems,
// not from the session.
const retrievedSession = {
  id: SESSION_ID,
  customer_details: mockSession.customer_details,
  shipping_details: mockSession.shipping_details,
  amount_total: 2706,
  total_details: { amount_tax: 206 },
};

// A request the way Vercel hands it to the function: method, headers, and the
// body as an async iterable of chunks.
function makeReq({
  method = 'POST',
  headers = { 'stripe-signature': 'sig_test' },
  chunks = [Buffer.from('{}')],
} = {}) {
  return {
    method,
    headers,
    async *[Symbol.asyncIterator]() {
      yield* chunks;
    },
  };
}

// Run the handler once and hand back what it answered.
async function deliver(request) {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  await handler(makeReq(request), res);
  return res;
}

// The [payload, options] the handler gave resend.emails.send on its one call.
const sentEmail = () => resend.sendEmail.mock.calls[0];

// Keeps an expected server-side log line out of the test output.
const silenceErrorLog = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('webhook handler', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fake');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_fake');
    vi.stubEnv('RESEND_API_KEY', 're_fake');
    vi.stubEnv('ORDER_NOTIFY_EMAIL', undefined);
    stripe.Stripe.mockReset();
    stripe.constructEvent.mockReset();
    stripe.retrieveSession.mockReset();
    stripe.listLineItems.mockReset();
    resend.Resend.mockReset();
    resend.sendEmail.mockReset();
    stripe.constructEvent.mockReturnValue({
      id: EVENT_ID,
      type: 'checkout.session.completed',
      data: { object: { id: SESSION_ID } },
    });
    stripe.retrieveSession.mockResolvedValue(retrievedSession);
    stripe.listLineItems.mockResolvedValue({ data: [tinLine, bagLine] });
    resend.sendEmail.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('passes the Stripe event id to Resend as the idempotency key', async () => {
    const res = await deliver();

    expect(res.statusCode).toBe(200);
    expect(resend.sendEmail).toHaveBeenCalledTimes(1);
    const [, options] = sentEmail();
    expect(options).toEqual({ idempotencyKey: EVENT_ID });
  });

  it('lists the session line items with their prices, up to the Stripe maximum of 100', async () => {
    await deliver();

    expect(stripe.listLineItems).toHaveBeenCalledTimes(1);
    expect(stripe.listLineItems).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ expand: ['data.price'], limit: 100 }),
    );
  });

  it('puts each line item and the tax amount in the email', async () => {
    await deliver();

    const [payload] = sentEmail();
    expect(payload.text).toContain('Jasmine Dream (loose-leaf-2oz) × 2');
    expect(payload.text).toContain('House Roast (whole-bean-12oz) × 1');
    expect(payload.text).toContain('Tax: $2.06');
    expect(payload.text).toContain('Total: $27.06');
  });

  it('sends the order email to ORDER_NOTIFY_EMAIL when it is set', async () => {
    vi.stubEnv('ORDER_NOTIFY_EMAIL', 'orders-inbox@example.com');

    await deliver();

    const [payload] = sentEmail();
    expect(payload.to).toBe('orders-inbox@example.com');
    expect(payload.from).toBe('orders@siphaven.com');
  });

  it.each([
    ['unset', undefined],
    ['blank', ''],
  ])('falls back to joseph@siphaven.com when ORDER_NOTIFY_EMAIL is %s', async (_case, value) => {
    vi.stubEnv('ORDER_NOTIFY_EMAIL', value);

    await deliver();

    expect(sentEmail()[0].to).toBe('joseph@siphaven.com');
  });

  it('still sends the order email, with a note, when the line items cannot be listed', async () => {
    const log = silenceErrorLog();
    const failure = new Error('Stripe is down');
    stripe.listLineItems.mockRejectedValue(failure);

    const res = await deliver();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    const [payload, options] = sentEmail();
    expect(payload.text).toContain('Items could not be loaded');
    expect(payload.text).toContain('Jane Doe');
    expect(payload.text).toContain('Tax: $2.06');
    expect(options).toEqual({ idempotencyKey: EVENT_ID });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toContain(failure);
  });

  it('answers 500, so Stripe retries, when Resend reports an error', async () => {
    // resend v6 hands API and network failures back as { error } and does not throw.
    const log = silenceErrorLog();
    const failure = { name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' };
    resend.sendEmail.mockResolvedValue({ data: null, error: failure });

    const res = await deliver();

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to send notification email' });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toContain(failure);
  });

  it('answers 500, so Stripe retries, when sending the email throws', async () => {
    const log = silenceErrorLog();
    const failure = new Error('socket hang up');
    resend.sendEmail.mockRejectedValue(failure);

    const res = await deliver();

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to send notification email' });
    expect(log.mock.calls[0]).toContain(failure);
  });

  it('checks the signature against the raw body, the stripe-signature header and the webhook secret', async () => {
    await deliver({ chunks: [Buffer.from('{"a":'), Buffer.from('1}')] });

    expect(stripe.constructEvent).toHaveBeenCalledTimes(1);
    const [rawBody, signature, secret] = stripe.constructEvent.mock.calls[0];
    expect(rawBody.toString()).toBe('{"a":1}');
    expect(signature).toBe('sig_test');
    expect(secret).toBe('whsec_fake');
  });

  it('rejects a signature that does not verify and sends nothing', async () => {
    silenceErrorLog();
    stripe.constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    const res = await deliver();

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid signature' });
    expect(stripe.retrieveSession).not.toHaveBeenCalled();
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it('acknowledges events other than checkout.session.completed without emailing', async () => {
    stripe.constructEvent.mockReturnValue({
      id: 'evt_other',
      type: 'payment_intent.created',
      data: { object: { id: 'pi_test_1' } },
    });

    const res = await deliver();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(stripe.retrieveSession).not.toHaveBeenCalled();
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it('answers 500 and sends nothing when the session cannot be retrieved', async () => {
    silenceErrorLog();
    stripe.retrieveSession.mockRejectedValue(new Error('No such checkout.session'));

    const res = await deliver();

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to retrieve session' });
    expect(resend.sendEmail).not.toHaveBeenCalled();
  });

  it('answers 405 to anything but POST', async () => {
    const res = await deliver({ method: 'GET' });

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
    expect(stripe.Stripe).not.toHaveBeenCalled();
  });
});
