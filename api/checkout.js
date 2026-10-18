import Stripe from 'stripe';
import { findVariant } from '../lib/catalog.js';
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
    // load-lineup has given it a Stripe price.
    const found = findVariant(slug, variantId);
    if (!found?.variant.stripe_price_id) {
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

  const origin = req.headers.origin || 'http://localhost:5174';

  try {
    const { line_items, subtotal_cents } = buildLineItems(items);

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
