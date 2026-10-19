// The rules for a cart, as plain functions over a list of lines. No React, no storage.
//
// A line is { slug, variantId, qty }: just which product, which of its variants, and
// how many. The price and the names are always looked up in the lineup, never kept
// in the cart, so a cart can never carry a stale or tampered price into checkout.
// There is one line per slug and variant.
import { findVariant } from '../../lib/catalog.js';
import { MAX_QTY } from '../../lib/store-config.js';

const clampQty = (qty) => Math.min(MAX_QTY, Math.max(1, qty));

const isWholeCount = (value) => Number.isInteger(value) && value >= 1;

const isMatch = (slug, variantId) => (line) => line.slug === slug && line.variantId === variantId;

/**
 * Whether this variant can be bought: it is in the lineup and has a stripe_price_id.
 * findVariant does not check the price id, so it is checked here.
 */
export function isPurchasable(slug, variantId) {
  return Boolean(findVariant(slug, variantId)?.variant.stripe_price_id);
}

/**
 * The cart with `qty` more of this variant: a new line, or a bigger quantity on the
 * line that is already there, never above MAX_QTY. The same list comes back when the
 * variant cannot be bought or `qty` is not a whole number of 1 or more.
 */
export function addLine(lines, slug, variantId, qty = 1) {
  if (!isWholeCount(qty) || !isPurchasable(slug, variantId)) return lines;

  const index = lines.findIndex(isMatch(slug, variantId));
  if (index === -1) return [...lines, { slug, variantId, qty: clampQty(qty) }];

  return lines.map((line, position) =>
    position === index ? { ...line, qty: clampQty(line.qty + qty) } : line,
  );
}

/**
 * The cart with this line set to `qty`, kept between 1 and MAX_QTY (the remove button
 * is how a line goes away). The same list comes back when there is no such line, the
 * quantity is already that, or `qty` is not a whole number.
 */
export function setLineQty(lines, slug, variantId, qty) {
  if (!Number.isInteger(qty)) return lines;

  const next = clampQty(qty);
  const index = lines.findIndex(isMatch(slug, variantId));
  if (index === -1 || lines[index].qty === next) return lines;

  return lines.map((line, position) => (position === index ? { ...line, qty: next } : line));
}

/** The cart without this line. The same list comes back when there is no such line. */
export function removeLine(lines, slug, variantId) {
  const index = lines.findIndex(isMatch(slug, variantId));
  return index === -1 ? lines : lines.filter((_line, position) => position !== index);
}

/** The cart's price in cents, from the lineup. A line it cannot price counts as nothing. */
export function subtotalCents(lines) {
  return lines.reduce((total, { slug, variantId, qty }) => {
    const found = findVariant(slug, variantId);
    return found ? total + found.variant.price_cents * qty : total;
  }, 0);
}

/** How many units are in the cart (not how many lines). */
export function itemCount(lines) {
  return lines.reduce((total, { qty }) => total + qty, 0);
}

/** Whether two carts hold the same lines in the same order. */
export function sameLines(a, b) {
  return (
    a.length === b.length &&
    a.every(
      (line, index) =>
        line.slug === b[index].slug &&
        line.variantId === b[index].variantId &&
        line.qty === b[index].qty,
    )
  );
}

// What our own code always writes. Anything else in storage is not from us.
const isLineShape = (entry) =>
  typeof entry === 'object' &&
  entry !== null &&
  typeof entry.slug === 'string' &&
  typeof entry.variantId === 'string' &&
  isWholeCount(entry.qty);

/**
 * Turn whatever was saved into a cart that is safe to use: { lines, droppedStale }.
 *
 * Anything that is not a list is an empty cart. Entries that are not shaped like a
 * line are dropped quietly, because our own code never writes them. A line that is
 * well formed but whose product or variant is gone from the lineup, or no longer
 * has a stripe_price_id, is dropped too and `droppedStale` is true, so the shopper
 * can be told; that is what a later lineup does to an old cart. A quantity above
 * MAX_QTY is pulled down to it and a line saved twice is merged.
 */
export function restoreLines(stored) {
  if (!Array.isArray(stored)) return { lines: [], droppedStale: false };

  let lines = [];
  let droppedStale = false;

  for (const entry of stored) {
    if (!isLineShape(entry)) continue;
    if (isPurchasable(entry.slug, entry.variantId)) {
      lines = addLine(lines, entry.slug, entry.variantId, entry.qty);
    } else {
      droppedStale = true;
    }
  }

  return { lines, droppedStale };
}
