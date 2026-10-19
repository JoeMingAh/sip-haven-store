import Stripe from 'stripe';
import { Resend } from 'resend';

// Vercel must NOT parse the body — Stripe signature verification needs raw bytes
export const config = { api: { bodyParser: false } };

// Where order emails go when ORDER_NOTIFY_EMAIL is not set.
const DEFAULT_NOTIFY_EMAIL = 'joseph@siphaven.com';

// Integer cents as dollars, like $25.00.
const usd = (cents) => `$${(cents / 100).toFixed(2)}`;

// What Resend answers when an idempotency key it has already seen comes with a
// different email. The key is the Stripe event id, so it means this event's notice went
// out on an earlier delivery and this one's wording has changed since (Resend v6 hands
// the error back as { name, statusCode, message }; the code is checked too).
const REUSED_KEY = 'invalid_idempotent_request';
const isAlreadySent = (error) => error?.name === REUSED_KEY || error?.code === REUSED_KEY;

// One order line. A price made by load-lineup carries its variant id in its
// metadata, and the line description is only the product name, so such a line
// reads "Name (variant-id) × 2". A line with no variant id (an order from before
// the lineup, or a price made by hand) keeps the plain "Name x2" form.
function formatLineItem(item) {
  const name = item.description || 'Unknown item';
  const variantId = item.price?.metadata?.variant_id;
  return variantId
    ? `- ${name} (${variantId}) × ${item.quantity}`
    : `- ${name} x${item.quantity}`;
}

// `session.line_items` is the order's line items, the list that
// stripe.checkout.sessions.listLineItems returns. When it is missing the email
// still goes out and says so, because the order notice must not be lost.
export function buildOrderEmail(session) {
  const name = session.customer_details?.name || 'Unknown';
  const email = session.customer_details?.email || 'Unknown';
  // Stripe's current API (the v22 SDK types) puts the address at
  // session.collected_information.shipping_details and has no session.shipping_details.
  // Read the new place first and fall back to the old one, so a session from an
  // older API version still prints its address (Ruling R15).
  const shipping = session.collected_information?.shipping_details ?? session.shipping_details;
  const address = shipping?.address;

  const addressText = address
    ? [
        address.line1,
        address.line2,
        `${address.city}, ${address.state} ${address.postal_code}`,
      ]
        .filter(Boolean)
        .join('\n')
    : 'No address provided';

  const itemsText = session.line_items
    ? (session.line_items.data || []).map(formatLineItem).join('\n')
    : 'Items could not be loaded from Stripe. Check this order in the Stripe dashboard.';

  const tax = usd(session.total_details?.amount_tax ?? 0);
  const total = usd(session.amount_total);

  return {
    subject: `New Order — ${name}`,
    text: [
      'New order received!',
      '',
      `Customer: ${name}`,
      `Email: ${email}`,
      '',
      'Shipping Address:',
      addressText,
      '',
      'Items:',
      itemsText,
      '',
      `Tax: ${tax}`,
      `Total: ${total}`,
    ].join('\n'),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Collect raw body for Stripe signature verification (cap at 1MB)
  const chunks = [];
  let totalSize = 0;
  for await (const chunk of req) {
    totalSize += chunk.length;
    if (totalSize > 1_000_000) {
      return res.status(413).json({ error: 'Payload too large' });
    }
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  let session;
  try {
    // The line items come from listLineItems below, so nothing is expanded here.
    session = await stripe.checkout.sessions.retrieve(event.data.object.id);
  } catch (err) {
    console.error('Failed to retrieve Stripe session:', err);
    return res.status(500).json({ error: 'Failed to retrieve session' });
  }

  // Failing to list the items must not lose the order notice: log it, and the
  // email says the items are missing. A Stripe list returns 10 by default and 100
  // at most, so ask for 100 to keep a big cart from being cut off.
  let lineItems = null;
  try {
    lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ['data.price'],
      limit: 100,
    });
  } catch (err) {
    console.error('Failed to list line items:', err);
  }

  const { subject, text } = buildOrderEmail({ ...session, line_items: lineItems });

  const resend = new Resend(process.env.RESEND_API_KEY);

  let sendError;
  try {
    // event.id is the same on every delivery of this event. When Stripe retries
    // it, Resend sees the same idempotency key and does not send a second email.
    const result = await resend.emails.send(
      {
        from: 'orders@siphaven.com',
        to: process.env.ORDER_NOTIFY_EMAIL || DEFAULT_NOTIFY_EMAIL,
        subject,
        text,
      },
      { idempotencyKey: event.id }
    );
    // resend v6 hands a failed send back as { error } and does not throw.
    sendError = result?.error;
  } catch (err) {
    sendError = err;
  }
  if (sendError) {
    if (isAlreadySent(sendError)) {
      // The notice is out already. Another 500 would only make Stripe deliver this
      // event again, and again, for days, and every try would be refused the same way.
      console.warn(`Order email for ${event.id} was already sent; not sending it again.`);
      return res.status(200).json({ received: true });
    }
    // A 500 makes Stripe deliver the event again, and the idempotency key keeps
    // that retry from double-sending if the first attempt did go through.
    console.error('Failed to send email:', sendError);
    return res.status(500).json({ error: 'Failed to send notification email' });
  }

  return res.status(200).json({ received: true });
}
