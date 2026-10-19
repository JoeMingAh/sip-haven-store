// How the storefront writes things down: prices and format names. Prices are whole
// cents everywhere in the data.
import { FORMAT_LABELS } from '../lib/filter.js';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 1850 -> "$18.50", 5000 -> "$50.00". */
export function formatPrice(cents) {
  return usd.format(cents / 100);
}

/**
 * 'loose-leaf' -> "Loose leaf". A format the shop has no name for (the lineup check
 * refuses them, but data can be wrong) is shown as it is.
 */
export function formatLabel(format) {
  return Object.hasOwn(FORMAT_LABELS, format) ? FORMAT_LABELS[format] : format;
}
