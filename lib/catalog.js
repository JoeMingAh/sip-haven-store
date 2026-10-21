// The shop's catalog: one data file (src/data/lineup.json) and the helpers that
// read and check it. The React app, the /api functions and the scripts all import
// this, so it must not depend on anything browser-only or Node-only.
//
// lineup.json is { "products": Product[] }.
//   Product: slug, name, category ('tea' | 'coffee'), short_description,
//     flavor_notes: string[], caffeine ('none' | 'low' | 'medium' | 'high'),
//     tags: string[], featured: boolean, images: string[], variants: Variant[];
//     optional: tea_type, story, ingredients, origin, tax_code (all text),
//     aromas: string[] (what the quiz's aroma question looks for),
//     moods: string[] (what the quiz's mood question looks for),
//     brew_guide { water_temp, amount, steep_time }, and subscribable
//     (reserved for later, accepted and ignored).
//   Variant: id (unique within its product, like 'loose-leaf-2oz'), format,
//     size_label, price_cents; optional: cups, stripe_price_id.
// A variant can only be bought once load-lineup has given it a stripe_price_id.
import lineup from '../src/data/lineup.json' with { type: 'json' };

const FORMATS = {
  tea: ['loose-leaf', 'tea-bags', 'k-cup'],
  coffee: ['whole-bean', 'ground'],
};
const CATEGORIES = Object.keys(FORMATS);
const ALL_FORMATS = Object.values(FORMATS).flat();
const CAFFEINE_LEVELS = ['none', 'low', 'medium', 'high'];
const LIST_FIELDS = ['flavor_notes', 'tags', 'images'];
// Lists a product may leave out. aromas and moods came after the first lineups were
// written.
const OPTIONAL_LIST_FIELDS = ['aromas', 'moods'];
const OPTIONAL_TEXT_FIELDS = ['tea_type', 'story', 'ingredients', 'origin', 'tax_code'];
const BREW_GUIDE_PARTS = ['water_temp', 'amount', 'steep_time'];
// Slugs end up in URLs (/products/:slug) and Stripe metadata.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isMissing = (value) => value === undefined || value === null;
const isText = (value) => typeof value === 'string' && value.trim() !== '';

// A value as it appears in an error message: 'gear', 42, or "nothing".
function show(value) {
  if (isMissing(value) || value === '') return 'nothing';
  return typeof value === 'string' ? `'${value}'` : JSON.stringify(value);
}

// ['a', 'b', 'c'] -> "'a', 'b' or 'c'"
function oneOf(options) {
  const quoted = options.map((option) => `'${option}'`);
  if (quoted.length < 2) return quoted.join('');
  return `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1]}`;
}

// How a message refers to a product: its name, else its slug, else its position.
function productLabel(product, index) {
  if (isText(product.name)) return product.name;
  if (isText(product.slug)) return product.slug;
  return `Product #${index + 1}`;
}

function checkVariants(product, categoryIsValid, problem) {
  const seenIds = new Set();

  product.variants.forEach((variant, position) => {
    if (!isObject(variant)) {
      problem(`variant #${position + 1} must have an id, format, size_label and price_cents`);
      return;
    }

    // How messages refer to this variant: by id when it has one.
    const ref = isText(variant.id) ? `'${variant.id}'` : `variant #${position + 1}`;

    if (!isText(variant.id)) {
      problem(`variant #${position + 1} is missing an id`);
    } else if (seenIds.has(variant.id)) {
      problem(`variant id '${variant.id}' is used more than once`);
    } else {
      seenIds.add(variant.id);
    }

    if (categoryIsValid) {
      if (!FORMATS[product.category].includes(variant.format)) {
        problem(
          `format for ${ref} must be ${oneOf(FORMATS[product.category])} for ${product.category} ` +
            `(got ${show(variant.format)})`,
        );
      }
    } else if (!ALL_FORMATS.includes(variant.format)) {
      // The bad category is reported once on its own; still catch formats nobody sells.
      problem(`format for ${ref} must be one of ${oneOf(ALL_FORMATS)} (got ${show(variant.format)})`);
    }

    if (!isText(variant.size_label)) {
      problem(`size_label for ${ref} is required`);
    }

    const price = variant.price_cents;
    if (typeof price !== 'number' || !Number.isFinite(price)) {
      problem(`price for ${ref} is missing or not a number`);
    } else if (price <= 0) {
      problem(`price for ${ref} must be more than $0`);
    } else if (!Number.isInteger(price)) {
      problem(`price for ${ref} must be a whole number of cents (got ${price})`);
    }

    if (!isMissing(variant.cups) && !(Number.isInteger(variant.cups) && variant.cups >= 1)) {
      problem(`cups for ${ref} must be a whole number, 1 or more`);
    }

    if (!isMissing(variant.stripe_price_id) && typeof variant.stripe_price_id !== 'string') {
      problem(`stripe_price_id for ${ref} must be text`);
    }
  });
}

function checkProduct(product, index, slugOwners, errors) {
  const label = productLabel(product, index);
  const problem = (message) => errors.push(`${label}: ${message}`);

  if (!isText(product.name)) problem('name is required');

  if (!isText(product.slug)) {
    problem('slug is required');
  } else {
    if (!SLUG_PATTERN.test(product.slug)) {
      problem(
        `slug ${show(product.slug)} can only use lowercase letters, numbers and dashes ` +
          `(like 'jasmine-dream')`,
      );
    }
    const first = slugOwners.get(product.slug);
    if (first) {
      problem(
        `slug ${show(product.slug)} is already used by product #${first.index + 1} (${first.label})`,
      );
    } else {
      slugOwners.set(product.slug, { index, label });
    }
  }

  const categoryIsValid = CATEGORIES.includes(product.category);
  if (!categoryIsValid) {
    problem(`category must be ${oneOf(CATEGORIES)} (got ${show(product.category)})`);
  }

  if (!isText(product.short_description)) problem('short_description is required');

  if (!CAFFEINE_LEVELS.includes(product.caffeine)) {
    problem(`caffeine must be ${oneOf(CAFFEINE_LEVELS)} (got ${show(product.caffeine)})`);
  }

  for (const field of [...LIST_FIELDS, ...OPTIONAL_LIST_FIELDS]) {
    const value = product[field];
    if (OPTIONAL_LIST_FIELDS.includes(field) && isMissing(value)) continue;
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      problem(`${field} must be a list of text`);
    }
  }

  if (typeof product.featured !== 'boolean') problem('featured must be true or false');

  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (!isMissing(product[field]) && typeof product[field] !== 'string') {
      problem(`${field} must be text`);
    }
  }

  if (!isMissing(product.brew_guide)) {
    if (!isObject(product.brew_guide)) {
      problem(`brew_guide must have ${BREW_GUIDE_PARTS.join(', ')}`);
    } else {
      const absent = BREW_GUIDE_PARTS.filter((part) => !isText(product.brew_guide[part]));
      if (absent.length > 0) problem(`brew_guide is missing ${absent.join(', ')}`);
    }
  }

  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    problem('needs at least one variant (a format and size with a price)');
  } else {
    checkVariants(product, categoryIsValid, problem);
  }
}

/**
 * Check a lineup before it is loaded. Reports every problem at once, in plain
 * English, each one starting with the name of the product it is about.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateLineup(data) {
  if (!isObject(data) || !Array.isArray(data.products)) {
    return { ok: false, errors: ['The lineup must look like { "products": [ ... ] }.'] };
  }

  const errors = [];
  const slugOwners = new Map();

  data.products.forEach((product, index) => {
    if (!isObject(product)) {
      errors.push(`Product #${index + 1}: must be an object with a name, slug, variants and so on`);
      return;
    }
    checkProduct(product, index, slugOwners, errors);
  });

  return { ok: errors.length === 0, errors };
}

// The lookups below take the lineup as an optional last argument (defaulting to
// the real one) so tests can pass a fixture.
const productsOf = (data) => (Array.isArray(data?.products) ? data.products : []);

/** All products, or only those in `category`. Always a new array. */
export function getProducts(category, data = lineup) {
  const products = productsOf(data);
  return category ? products.filter((product) => product.category === category) : [...products];
}

/** The product with this slug, or undefined. */
export function getProduct(slug, data = lineup) {
  return productsOf(data).find((product) => product.slug === slug);
}

/**
 * The variants that can be bought: only those that have a stripe_price_id. An id with
 * nothing in it but spaces counts as none, like an empty one. This is the one answer to
 * "can it be bought?": the shop, the cart and /api/checkout all ask it.
 */
export function purchasableVariants(product) {
  return (product?.variants ?? []).filter((variant) => isText(variant?.stripe_price_id));
}

/**
 * The product and variant for a slug and variant id, or undefined. Purchasability
 * is not checked here; callers that sell the variant check stripe_price_id (or use
 * purchasableVariants).
 */
export function findVariant(slug, variantId, data = lineup) {
  const product = getProduct(slug, data);
  const variant = product?.variants?.find((candidate) => candidate.id === variantId);
  return variant ? { product, variant } : undefined;
}

/**
 * The lowest price, in cents, among the purchasable variants. null when nothing
 * is purchasable, so a caller can never show a made-up price.
 */
export function fromPriceCents(product) {
  const prices = purchasableVariants(product).map((variant) => variant.price_cents);
  return prices.length > 0 ? Math.min(...prices) : null;
}
