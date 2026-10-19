// Filtering for the tea and coffee shop pages. Everything here is a plain function
// of the lineup and of the page address, with no React in it, so the pages and the
// Node tests share the same code.
//
// A choice looks like { flavors: string[], caffeine: string[], formats: string[] }.
// Values within a group are alternatives (any one will do), every group that has
// something picked has to match, and a group with nothing picked is ignored.
//
// The page address carries the choice, so a filtered page can be shared: one
// repeated parameter per ticked box, like
//   /tea?flavor=honey&caffeine=low&caffeine=none&format=k-cup
// Not comma-separated, because a flavor note may contain a comma.

// How a value reads for shoppers. The order of the keys is the order the boxes are
// listed in. A value that is not listed (the lineup check refuses them, but data can
// be wrong) is still offered, after the listed ones and under its own text.
export const CAFFEINE_LABELS = {
  none: 'Caffeine-free',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
export const FORMAT_LABELS = {
  'loose-leaf': 'Loose leaf',
  'tea-bags': 'Tea bags',
  'k-cup': 'K-Cup',
  'whole-bean': 'Whole bean',
  ground: 'Ground',
};

// The address parameter for each group.
const PARAM = { flavors: 'flavor', caffeine: 'caffeine', formats: 'format' };

const asList = (value) => (Array.isArray(value) ? value : []);

// "Honey " and "honey" are the same flavor.
const flavorKey = (note) => (typeof note === 'string' ? note.trim().toLowerCase() : '');

/**
 * The products that match `filters`: any one value within a group, and all of the
 * groups that have something picked. A product matches a format when any of its
 * variants has it. Always a new array, in the order of `products`.
 */
export function filterProducts(products, filters) {
  const flavors = asList(filters?.flavors).map(flavorKey).filter(Boolean);
  const caffeine = asList(filters?.caffeine);
  const formats = asList(filters?.formats);

  return asList(products).filter((product) => {
    if (
      flavors.length > 0 &&
      !asList(product?.flavor_notes).some((note) => flavors.includes(flavorKey(note)))
    ) {
      return false;
    }
    if (caffeine.length > 0 && !caffeine.includes(product?.caffeine)) return false;
    if (
      formats.length > 0 &&
      !asList(product?.variants).some((variant) => formats.includes(variant?.format))
    ) {
      return false;
    }
    return true;
  });
}

// { value, label } for each of `values`: the ones named in `labels` first, in its
// order, then any others in the order they were met.
function listed(values, labels) {
  const order = Object.keys(labels);
  const rank = (value) => {
    const index = order.indexOf(value);
    return index === -1 ? order.length : index;
  };
  return [...values]
    .sort((a, b) => rank(a) - rank(b))
    .map((value) => ({ value, label: Object.hasOwn(labels, value) ? labels[value] : value }));
}

/**
 * The boxes to offer for these products, each { value, label }: the flavors they
 * have (once each, A to Z), the caffeine levels they have (none up to high) and the
 * formats any of their variants come in. Nothing is offered that no product has.
 * @returns {{ flavors: object[], caffeine: object[], formats: object[] }}
 */
export function filterOptions(products) {
  const flavors = new Map(); // flavor as compared -> the way it was first written
  const caffeine = new Set();
  const formats = new Set();

  for (const product of asList(products)) {
    for (const note of asList(product?.flavor_notes)) {
      const key = flavorKey(note);
      if (key && !flavors.has(key)) flavors.set(key, note.trim());
    }
    if (typeof product?.caffeine === 'string' && product.caffeine !== '') {
      caffeine.add(product.caffeine);
    }
    for (const variant of asList(product?.variants)) {
      if (typeof variant?.format === 'string' && variant.format !== '') formats.add(variant.format);
    }
  }

  return {
    flavors: [...flavors]
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([value, label]) => ({ value, label })),
    caffeine: listed(caffeine, CAFFEINE_LABELS),
    formats: listed(formats, FORMAT_LABELS),
  };
}

/**
 * The choice a page address holds, as the page can honor it: only values that
 * `options` (from filterOptions) offers, each once, in the order they are listed.
 * Anything else in the address is ignored.
 * @param {URLSearchParams} searchParams
 */
export function readFilters(searchParams, options) {
  const read = (group) => {
    const asked = searchParams
      .getAll(PARAM[group])
      .map((value) => (group === 'flavors' ? flavorKey(value) : value));
    return asList(options?.[group])
      .map((option) => option.value)
      .filter((value) => asked.includes(value));
  };

  return { flavors: read('flavors'), caffeine: read('caffeine'), formats: read('formats') };
}

/**
 * The page address parameters for a choice: `searchParams` with the filter
 * parameters replaced by `filters` (none left when nothing is picked) and everything
 * else kept. Returns new parameters and leaves `searchParams` alone.
 * @param {URLSearchParams} searchParams
 */
export function writeFilters(searchParams, filters) {
  const next = new URLSearchParams(searchParams);
  for (const [group, name] of Object.entries(PARAM)) {
    next.delete(name);
    for (const value of asList(filters?.[group])) next.append(name, value);
  }
  return next;
}
