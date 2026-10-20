// "You might also like" on the product page. A plain function of the products, with
// no React in it, so the page and the Node tests share the same code.
import { purchasableVariants } from './catalog.js';

// How many suggestions a product page shows.
export const RELATED_LIMIT = 3;

const asList = (value) => (Array.isArray(value) ? value : []);

// "Floral " and "floral" are the same tag.
const tagKey = (tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : '');

// The distinct tags of a product, as compared. A blank tag counts for nothing.
function tagSet(product) {
  return new Set(asList(product?.tags).map(tagKey).filter(Boolean));
}

const canBeBought = (product) => purchasableVariants(product).length > 0;

/**
 * Up to `limit` of `products` that suit someone looking at `product`: the same
 * category, at least one tag in common, and something that can be bought (a
 * variant with a stripe_price_id), never the product itself. The ones sharing the
 * most tags come first, and ties keep the order of `products`. Always a new array.
 */
export function relatedProducts(product, products, limit = RELATED_LIMIT) {
  const mine = tagSet(product);
  if (!product || mine.size === 0) return [];

  return asList(products)
    .filter((other) => other && other.slug !== product.slug && other.category === product.category)
    .filter(canBeBought)
    .map((other) => ({ other, shared: [...tagSet(other)].filter((tag) => mine.has(tag)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared) // Array.prototype.sort is stable, so ties keep their order.
    .slice(0, limit)
    .map(({ other }) => other);
}
