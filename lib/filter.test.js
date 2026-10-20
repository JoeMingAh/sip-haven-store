import { describe, it, expect } from 'vitest';
import { filterProducts, filterOptions, readFilters, writeFilters } from './filter.js';

// Small products with only the fields the filters look at.
const variant = (format) => ({
  id: `${format}-1`,
  format,
  size_label: 'one size',
  price_cents: 1500,
  stripe_price_id: `price_${format}`,
});

const product = (slug, overrides = {}) => ({
  slug,
  name: slug,
  category: 'tea',
  short_description: 'A tea.',
  flavor_notes: [],
  caffeine: 'low',
  tags: [],
  featured: false,
  images: [],
  variants: [variant('loose-leaf')],
  ...overrides,
});

const jasmine = product('jasmine', {
  flavor_notes: ['floral', 'honey'],
  caffeine: 'low',
  variants: [variant('loose-leaf'), variant('tea-bags')],
});
const chamomile = product('chamomile', {
  flavor_notes: ['floral', 'apple'],
  caffeine: 'none',
  variants: [variant('tea-bags')],
});
const breakfast = product('breakfast', {
  flavor_notes: ['malty', 'honey'],
  caffeine: 'high',
  variants: [variant('loose-leaf'), variant('k-cup')],
});
const mint = product('mint', {
  flavor_notes: ['mint'],
  caffeine: 'none',
  variants: [variant('k-cup')],
});
const PRODUCTS = [jasmine, chamomile, breakfast, mint];

const NONE = { flavors: [], caffeine: [], formats: [] };
const slugs = (list) => list.map((item) => item.slug);
const params = (query) => new URLSearchParams(query);

describe('filterProducts', () => {
  describe('with nothing picked', () => {
    it.each([
      ['undefined', undefined],
      ['an empty object', {}],
      ['three empty groups', NONE],
    ])('returns every product for %s', (_label, filters) => {
      const result = filterProducts(PRODUCTS, filters);
      expect(slugs(result)).toEqual(['jasmine', 'chamomile', 'breakfast', 'mint']);
      // A new array, so a caller can sort or change it without touching the lineup.
      expect(result).not.toBe(PRODUCTS);
    });
  });

  describe('within one group (any of the picked values)', () => {
    it('matches a product with any of the picked flavors', () => {
      expect(slugs(filterProducts(PRODUCTS, { ...NONE, flavors: ['malty', 'mint'] }))).toEqual([
        'breakfast',
        'mint',
      ]);
    });

    it('matches a product with any of the picked caffeine levels', () => {
      expect(slugs(filterProducts(PRODUCTS, { ...NONE, caffeine: ['low', 'high'] }))).toEqual([
        'jasmine',
        'breakfast',
      ]);
    });

    it('matches a product with any of the picked formats, so more picks never mean fewer products', () => {
      expect(slugs(filterProducts(PRODUCTS, { ...NONE, formats: ['k-cup'] }))).toEqual([
        'breakfast',
        'mint',
      ]);
      expect(slugs(filterProducts(PRODUCTS, { ...NONE, formats: ['k-cup', 'tea-bags'] }))).toEqual([
        'jasmine',
        'chamomile',
        'breakfast',
        'mint',
      ]);
    });

    it('keeps the order of the lineup, not the order of the picks', () => {
      expect(slugs(filterProducts(PRODUCTS, { ...NONE, caffeine: ['high', 'none'] }))).toEqual([
        'chamomile',
        'breakfast',
        'mint',
      ]);
    });
  });

  describe('across groups (all of them have to match)', () => {
    it('needs both a caffeine level and a format', () => {
      expect(
        slugs(filterProducts(PRODUCTS, { flavors: [], caffeine: ['none'], formats: ['k-cup'] })),
      ).toEqual(['mint']);
    });

    it('needs a flavor and one of several caffeine levels', () => {
      expect(
        slugs(filterProducts(PRODUCTS, { flavors: ['honey'], caffeine: ['high', 'low'], formats: [] })),
      ).toEqual(['jasmine', 'breakfast']);
    });

    it('applies all three groups together', () => {
      const filters = { flavors: ['floral', 'mint'], caffeine: ['none'], formats: ['tea-bags'] };
      expect(slugs(filterProducts(PRODUCTS, filters))).toEqual(['chamomile']);
    });

    it('returns nothing when the groups cannot all be met', () => {
      expect(filterProducts(PRODUCTS, { flavors: ['floral'], caffeine: [], formats: ['k-cup'] })).toEqual(
        [],
      );
    });

    it('ignores a group with nothing picked', () => {
      const filters = { flavors: [], caffeine: ['none'], formats: [] };
      expect(slugs(filterProducts(PRODUCTS, filters))).toEqual(['chamomile', 'mint']);
    });
  });

  describe('matching rules', () => {
    it('matches a format when any variant of the product has it', () => {
      // Jasmine's second variant is tea bags; its first is loose leaf.
      expect(slugs(filterProducts(PRODUCTS, { ...NONE, formats: ['tea-bags'] }))).toEqual([
        'jasmine',
        'chamomile',
      ]);
      expect(slugs(filterProducts(PRODUCTS, { ...NONE, formats: ['loose-leaf'] }))).toEqual([
        'jasmine',
        'breakfast',
      ]);
    });

    it('matches flavors without regard to case or stray spaces', () => {
      expect(slugs(filterProducts(PRODUCTS, { ...NONE, flavors: ['  FLORAL '] }))).toEqual([
        'jasmine',
        'chamomile',
      ]);
      const shouty = product('shouty', { flavor_notes: [' Honey '] });
      expect(slugs(filterProducts([shouty], { ...NONE, flavors: ['honey'] }))).toEqual(['shouty']);
    });

    it('does not mix up a flavor with the start of another', () => {
      expect(filterProducts(PRODUCTS, { ...NONE, flavors: ['mi'] })).toEqual([]);
    });

    it('returns an empty list when nothing matches', () => {
      expect(filterProducts(PRODUCTS, { ...NONE, flavors: ['smoky'] })).toEqual([]);
    });
  });

  describe('careful with bad data', () => {
    const bare = { slug: 'bare', name: 'Bare' };

    it('keeps a product with missing fields when nothing is picked', () => {
      expect(filterProducts([bare], NONE)).toEqual([bare]);
    });

    it('does not match a product with missing fields, and does not throw', () => {
      expect(filterProducts([bare], { ...NONE, flavors: ['floral'] })).toEqual([]);
      expect(filterProducts([bare], { ...NONE, caffeine: ['low'] })).toEqual([]);
      expect(filterProducts([bare], { ...NONE, formats: ['k-cup'] })).toEqual([]);
    });

    it('returns an empty list when there is no list of products', () => {
      expect(filterProducts(undefined, NONE)).toEqual([]);
      expect(filterProducts(null, NONE)).toEqual([]);
    });

    it('ignores a group that is not a list', () => {
      expect(slugs(filterProducts(PRODUCTS, { flavors: 'floral', caffeine: null }))).toHaveLength(4);
    });

    it('does not change the products or the filters it is given', () => {
      const products = structuredClone(PRODUCTS);
      const filters = { flavors: ['Floral'], caffeine: ['none'], formats: ['tea-bags'] };
      const filtersBefore = structuredClone(filters);
      filterProducts(products, filters);
      expect(products).toEqual(PRODUCTS);
      expect(filters).toEqual(filtersBefore);
    });
  });
});

describe('filterOptions', () => {
  const labels = (options) => options.map((option) => option.label);
  const values = (options) => options.map((option) => option.value);

  it('lists the flavors the products have, once each, in alphabetical order', () => {
    const { flavors } = filterOptions(PRODUCTS);
    expect(values(flavors)).toEqual(['apple', 'floral', 'honey', 'malty', 'mint']);
    expect(labels(flavors)).toEqual(['apple', 'floral', 'honey', 'malty', 'mint']);
  });

  it('lists only the caffeine levels the products have, from none up to high', () => {
    const { caffeine } = filterOptions([breakfast, mint, jasmine]);
    expect(values(caffeine)).toEqual(['none', 'low', 'high']);
    expect(labels(caffeine)).toEqual(['Caffeine-free', 'Low', 'High']);
  });

  it('writes the medium level as Medium', () => {
    const { caffeine } = filterOptions([product('medium-one', { caffeine: 'medium' })]);
    expect(caffeine).toEqual([{ value: 'medium', label: 'Medium' }]);
  });

  it('lists the formats found on any variant, in the order the shop lists them', () => {
    // K-cup is met first here, but loose leaf and tea bags come before it.
    const { formats } = filterOptions([mint, breakfast, chamomile]);
    expect(values(formats)).toEqual(['loose-leaf', 'tea-bags', 'k-cup']);
    expect(labels(formats)).toEqual(['Loose leaf', 'Tea bags', 'K-Cup']);
  });

  it('offers coffee formats for coffee, and never a tea one', () => {
    const beans = product('beans', {
      category: 'coffee',
      variants: [variant('ground'), variant('whole-bean')],
    });
    const { formats } = filterOptions([beans]);
    expect(values(formats)).toEqual(['whole-bean', 'ground']);
    expect(labels(formats)).toEqual(['Whole bean', 'Ground']);
  });

  it('counts "Honey" and "honey " as one flavor, labelled the way it was first written', () => {
    const { flavors } = filterOptions([
      product('a', { flavor_notes: ['Honey', 'fresh grass'] }),
      product('b', { flavor_notes: [' honey ', 'FRESH GRASS'] }),
    ]);
    expect(flavors).toEqual([
      { value: 'fresh grass', label: 'fresh grass' },
      { value: 'honey', label: 'Honey' },
    ]);
  });

  it('skips blank flavor notes', () => {
    const { flavors } = filterOptions([product('a', { flavor_notes: ['', '   ', 'floral'] })]);
    expect(values(flavors)).toEqual(['floral']);
  });

  it('puts a value it does not know last and labels it with its own text', () => {
    const { caffeine, formats } = filterOptions([
      product('odd', { caffeine: 'extreme', variants: [variant('pod')] }),
      jasmine,
      mint,
    ]);
    expect(values(caffeine)).toEqual(['none', 'low', 'extreme']);
    expect(labels(caffeine)).toEqual(['Caffeine-free', 'Low', 'extreme']);
    expect(values(formats)).toEqual(['loose-leaf', 'tea-bags', 'k-cup', 'pod']);
    expect(labels(formats).at(-1)).toBe('pod');
  });

  it('labels a value that is also an object property name with its own text', () => {
    const { caffeine } = filterOptions([product('odd', { caffeine: 'constructor' })]);
    expect(caffeine).toEqual([{ value: 'constructor', label: 'constructor' }]);
  });

  it('has nothing to offer when there are no products', () => {
    const empty = { flavors: [], caffeine: [], formats: [] };
    expect(filterOptions([])).toEqual(empty);
    expect(filterOptions(undefined)).toEqual(empty);
  });

  it('copes with products that have missing fields', () => {
    expect(filterOptions([{ slug: 'bare' }])).toEqual({ flavors: [], caffeine: [], formats: [] });
  });
});

describe('readFilters', () => {
  const OPTIONS = filterOptions(PRODUCTS);

  it('reads one repeated parameter per ticked box', () => {
    const query = 'flavor=honey&flavor=floral&caffeine=low&caffeine=none&format=k-cup';
    // Values come back in the order the page lists them, whatever order the address has.
    expect(readFilters(params(query), OPTIONS)).toEqual({
      flavors: ['floral', 'honey'],
      caffeine: ['none', 'low'],
      formats: ['k-cup'],
    });
  });

  it('finds nothing picked in an address without filters', () => {
    expect(readFilters(params(''), OPTIONS)).toEqual(NONE);
    expect(readFilters(params('utm_source=news&page=2'), OPTIONS)).toEqual(NONE);
  });

  it('ignores values the page does not offer', () => {
    // Medium caffeine and whole-bean coffee are not among these products.
    const query = 'caffeine=medium&caffeine=extreme&format=whole-bean&flavor=cocoa';
    expect(readFilters(params(query), OPTIONS)).toEqual(NONE);
  });

  it('keeps the valid values when some are not offered', () => {
    expect(readFilters(params('caffeine=nope&caffeine=low&format=ground'), OPTIONS)).toEqual({
      flavors: [],
      caffeine: ['low'],
      formats: [],
    });
  });

  it('counts a value repeated in the address once', () => {
    expect(readFilters(params('caffeine=low&caffeine=low'), OPTIONS).caffeine).toEqual(['low']);
  });

  it('ignores empty values', () => {
    expect(readFilters(params('caffeine=&flavor=&format'), OPTIONS)).toEqual(NONE);
  });

  it('matches flavors without regard to case', () => {
    expect(readFilters(params('flavor=HONEY'), OPTIONS).flavors).toEqual(['honey']);
  });

  it('reads flavors with spaces, written either way', () => {
    const options = filterOptions([product('grassy', { flavor_notes: ['fresh grass'] })]);
    expect(readFilters(params('flavor=fresh+grass'), options).flavors).toEqual(['fresh grass']);
    expect(readFilters(params('flavor=fresh%20grass'), options).flavors).toEqual(['fresh grass']);
  });

  it('does not split a value on commas', () => {
    expect(readFilters(params('caffeine=low,none'), OPTIONS).caffeine).toEqual([]);
  });

  it('copes with no options at all', () => {
    const nothing = filterOptions([]);
    expect(readFilters(params('caffeine=low&flavor=honey&format=k-cup'), nothing)).toEqual(NONE);
  });
});

describe('writeFilters', () => {
  it('writes one parameter for each picked value', () => {
    const next = writeFilters(params(''), {
      flavors: ['fresh grass'],
      caffeine: ['none', 'low'],
      formats: ['k-cup'],
    });
    expect(next.toString()).toBe('flavor=fresh+grass&caffeine=none&caffeine=low&format=k-cup');
  });

  it('replaces what the address had before', () => {
    const next = writeFilters(params('caffeine=low&format=k-cup'), { ...NONE, caffeine: ['high'] });
    expect(next.toString()).toBe('caffeine=high');
  });

  it('removes every filter parameter when nothing is picked', () => {
    const next = writeFilters(params('flavor=honey&caffeine=low&caffeine=none&format=k-cup'), NONE);
    expect(next.toString()).toBe('');
  });

  it('removes values the page would have ignored too', () => {
    expect(writeFilters(params('caffeine=nope&format=pod'), NONE).toString()).toBe('');
  });

  it('keeps parameters that are not filters', () => {
    const next = writeFilters(params('utm_source=news&caffeine=low'), NONE);
    expect(next.toString()).toBe('utm_source=news');
    const kept = writeFilters(params('utm_source=news'), { ...NONE, formats: ['k-cup'] });
    expect(kept.get('utm_source')).toBe('news');
    expect(kept.getAll('format')).toEqual(['k-cup']);
  });

  it('treats a missing group as nothing picked', () => {
    expect(writeFilters(params('format=k-cup'), { caffeine: ['low'] }).toString()).toBe('caffeine=low');
  });

  it('returns new parameters and leaves the ones it was given alone', () => {
    const before = params('caffeine=low');
    const next = writeFilters(before, NONE);
    expect(next).not.toBe(before);
    expect(before.toString()).toBe('caffeine=low');
  });

  it('round-trips with readFilters', () => {
    const options = filterOptions(PRODUCTS);
    const picked = { flavors: ['floral', 'honey'], caffeine: ['none', 'high'], formats: ['tea-bags'] };
    expect(readFilters(writeFilters(params(''), picked), options)).toEqual(picked);
  });
});
