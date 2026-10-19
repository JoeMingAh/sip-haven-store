// Where the cart is kept between visits: the browser's localStorage, under one key.
// Every read and write is wrapped, because localStorage can throw (private windows,
// blocked site data, a full quota) or be missing, and a cart that cannot be saved
// must still work for the visit.

// The "-v2" is the cart's shape: a list of { slug, variantId, qty }.
export const CART_STORAGE_KEY = 'siphaven-cart-v2';

/**
 * Whatever is saved, parsed, or null when nothing usable is. It is not checked
 * here; restoreLines (cartLines.js) decides what a good cart looks like.
 */
export function readStoredLines() {
  try {
    const text = window.localStorage.getItem(CART_STORAGE_KEY);
    return text === null ? null : JSON.parse(text);
  } catch {
    // Storage is blocked or the text is not JSON: start with an empty cart.
    return null;
  }
}

/** Save the cart. Fails quietly: the cart still works in memory for this visit. */
export function writeStoredLines(lines) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Nowhere to save it; nothing else to do.
  }
}
