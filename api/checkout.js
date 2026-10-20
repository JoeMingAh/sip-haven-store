import Stripe from 'stripe';
import { findVariant, purchasableVariants } from '../lib/catalog.js';
import {
  isStoreOpen,
  FREE_SHIPPING_CENTS,
  FLAT_SHIPPING_CENTS,
  MAX_QTY,
} from '../lib/store-config.js';

/**
 * A problem with the cart that the shopper can be told about. Anything else that
 * goes wrong during checkout is logged on the server and never shown.
 */
export class CheckoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CheckoutError';
  }
}

/**
 * The cart, as { slug, variantId, qty } lines, turned into Stripe line items plus
 * its subtotal in cents. Every price comes from the lineup, never from the
 * browser. Throws a CheckoutError for the first line that cannot be sold.
 */
export function buildLineItems(items) {
  let subtotalCents = 0;

  const lineItems = items.map((item) => {
    const { slug, variantId, qty } = item ?? {};

    // findVariant does not check purchasability. A variant can only be sold once
    // load-lineup has given it a Stripe price, and the shop decides that the same way
    // here as it does when it offers the variant (a blank price id is no price id).
    const found = findVariant(slug, variantId);
    if (!found || !purchasableVariants(found.product).includes(found.variant)) {
      throw new CheckoutError('That item is no longer available.');
    }

    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      throw new CheckoutError(`Quantity must be between 1 and ${MAX_QTY}.`);
    }

    subtotalCents += found.variant.price_cents * qty;
    return { price: found.variant.stripe_price_id, quantity: qty };
  });

  return { line_items: lineItems, subtotal_cents: subtotalCents };
}

/**
 * The shipping choice Checkout offers for a cart worth `subtotalCents`: free from
 * FREE_SHIPPING_CENTS up, otherwise the flat rate. Both live in lib/store-config.js.
 */
export function shippingOptions(subtotalCents) {
  const free = subtotalCents >= FREE_SHIPPING_CENTS;
  return [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        display_name: free ? 'Free shipping' : 'Standard shipping',
        fixed_amount: { amount: free ? 0 : FLAT_SHIPPING_CENTS, currency: 'usd' },
        // Item prices are tax exclusive (load-lineup makes them so). Shipping
        // matches, so Stripe Tax adds any tax on top instead of taking it out.
        tax_behavior: 'exclusive',
      },
    },
  ];
}

// A local dev server: http, localhost, and a port.
const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d{1,5}$/;

/**
 * The address Stripe sends the shopper back to after Checkout, with no path: the start
 * of success_url and cancel_url.
 *
 * The Origin header is whatever the caller says it is, so it is only used when it is
 * exactly a place this site is served from: SITE_URL, this deployment's own address
 * (https://VERCEL_URL, which is how a preview deploy gets back to itself) or, outside
 * production, a localhost address with a port. Any other Origin, or none, gets SITE_URL.
 * Throws when SITE_URL is not set and the Origin is not one of the others, because the
 * shopper then has nowhere safe to go back to.
 */
export function returnOrigin(requestOrigin) {
  // An Origin never ends in a slash, so one on SITE_URL would stop it ever matching.
  const siteUrl = (process.env.SITE_URL ?? '').trim().replace(/\/+$/, '');
  const vercelUrl = (process.env.VERCEL_URL ?? '').trim();
  const deploymentUrl = vercelUrl ? `https://${vercelUrl}` : '';

  const isTrusted =
    typeof requestOrigin === 'string' &&
    requestOrigin !== '' &&
    (requestOrigin === siteUrl ||
      requestOrigin === deploymentUrl ||
      (process.env.VERCEL_ENV !== 'production' && LOCALHOST_ORIGIN.test(requestOrigin)));
  if (isTrusted) return requestOrigin;

  if (siteUrl) return siteUrl;
  throw new Error(
    'SITE_URL is not set, and the request Origin is not an address this site is served from, ' +
      'so there is nowhere to send the shopper back to. Set SITE_URL, like https://siphaven.com.',
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Checked before the cart is read, so a closed shop tells a caller nothing
  // about its catalog.
  if (!isStoreOpen()) {
    return res.status(403).json({ error: 'Store is not open yet.' });
  }

  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  try {
    const { line_items, subtotal_cents } = buildLineItems(items);

    // After the cart check, so a bad cart is still a 400, and before the Stripe client,
    // so a site with nowhere to send the shopper back to never calls Stripe. If SITE_URL
    // is missing this throws, and the catch below logs it and answers the generic 500.
    const origin = returnOrigin(req.headers.origin);

    // Inside the try because the client throws when the secret key is missing.
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ['US'] },
      shipping_options: shippingOptions(subtotal_cents),
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
    });

    // Stripe leaves url empty on a session that is no longer active.
    if (!session.url) {
      throw new Error('Stripe returned a Checkout Session without a url.');
    }
    return res.status(200).json({ url: session.url });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return res.status(400).json({ error: err.message });
    }
    // Stripe errors and bugs stay in the server log. The shopper gets one
    // generic message, so no detail leaks.
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Payment session could not be created.' });
  }
}
