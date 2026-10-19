// The browser's side of checkout: send the cart to /api/checkout and get back where
// to send the shopper. The server prices everything from the lineup; the browser
// only says which variants and how many.
import { GENERIC_ERROR, errorFrom } from '../apiError.js';

// Stripe's Checkout address is https. Anything that is not a web address, a
// javascript: or data: one in particular, must never reach window.location.
function isWebAddress(value) {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Start a Stripe Checkout session for these cart lines ({ slug, variantId, qty }).
 *
 * Resolves to { url } when the shopper should be sent to Stripe, or { error } with
 * text that can be shown as it is: the server's own message, or the generic one when
 * there is none or the request itself failed. It never rejects.
 */
export async function startCheckout(lines) {
  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Exactly what api/checkout.js reads, and nothing else from the cart.
      body: JSON.stringify({
        items: lines.map(({ slug, variantId, qty }) => ({ slug, variantId, qty })),
      }),
    });

    if (!response.ok) return { error: await errorFrom(response) };

    const body = await response.json();
    return isWebAddress(body?.url) ? { url: body.url } : { error: GENERIC_ERROR };
  } catch {
    // Offline, the request never arrived, or the answer was not JSON.
    return { error: GENERIC_ERROR };
  }
}
