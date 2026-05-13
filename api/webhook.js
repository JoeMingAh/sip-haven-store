import Stripe from 'stripe';
import { Resend } from 'resend';

// Vercel must NOT parse the body — Stripe signature verification needs raw bytes
export const config = { api: { bodyParser: false } };

export function buildOrderEmail(session) {
  const name = session.customer_details?.name || 'Unknown';
  const email = session.customer_details?.email || 'Unknown';
  const address = session.shipping_details?.address;

  const addressText = address
    ? [
        address.line1,
        address.line2,
        `${address.city}, ${address.state} ${address.postal_code}`,
      ]
        .filter(Boolean)
        .join('\n')
    : 'No address provided';

  const itemsText = (session.line_items?.data || [])
    .map((item) => `- ${item.description || 'Unknown item'} x${item.quantity}`)
    .join('\n');

  const total = `$${(session.amount_total / 100).toFixed(2)}`;

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
    session = await stripe.checkout.sessions.retrieve(
      event.data.object.id,
      { expand: ['line_items.data.price.product'] }
    );
  } catch (err) {
    console.error('Failed to retrieve Stripe session:', err);
    return res.status(500).json({ error: 'Failed to retrieve session' });
  }

  const { subject, text } = buildOrderEmail(session);

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'orders@siphaven.com',
      to: 'joseph@siphaven.com',
      subject,
      text,
    });
  } catch (err) {
    console.error('Failed to send email:', err);
    return res.status(500).json({ error: 'Failed to send notification email' });
  }

  return res.status(200).json({ received: true });
}
