// How the storefront writes things down: prices and format names. Prices are whole
// cents everywhere in the data.
import { FORMAT_LABELS } from '../lib/filter.js';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const wholeUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** 1850 -> "$18.50", 5000 -> "$50.00". */
export function formatPrice(cents) {
  return usd.format(cents / 100);
}

/**
 * An amount written into a sentence, where "$50.00" would read heavy: a whole-dollar
 * amount drops its cents and any other keeps them. 5000 -> "$50", 695 -> "$6.95",
 * 4950 -> "$49.50". Prices on show still use formatPrice, so a total never changes shape.
 */
export function formatDollars(cents) {
  return cents % 100 === 0 ? wholeUsd.format(cents / 100) : usd.format(cents / 100);
}

/**
 * 'loose-leaf' -> "Loose leaf". A format the shop has no name for (the lineup check
 * refuses them, but data can be wrong) is shown as it is.
 */
export function formatLabel(format) {
  return Object.hasOwn(FORMAT_LABELS, format) ? FORMAT_LABELS[format] : format;
}
