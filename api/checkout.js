import Stripe from 'stripe';

export const STRIPE_PRICE_IDS = {
  'sippers-whisper': 'price_1TUJ0FLAf4l1OXJTpwFigruL',
  'sippers-murmur': 'price_1TUJ0aLAf4l1OXJTnViQqXOZ',
};

export function buildLineItems(items) {
  return items.map((item) => {
    const price = STRIPE_PRICE_IDS[item.id];
    if (!price) throw new Error(`Unknown product: ${item.id}`);
    return { price, quantity: item.qty };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  let line_items;
  try {
    line_items = buildLineItems(items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = req.headers.origin || 'http://localhost:5174';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: 'Payment session could not be created.' });
  }
}
