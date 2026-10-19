import { describe, it, expect } from 'vitest';
import { relatedProducts } from './related.js';

const variant = (overrides = {}) => ({
  id: 'loose-leaf-2oz',
  format: 'loose-leaf',
  size_label: '2 oz',
  price_cents: 1800,
  stripe_price_id: 'price_1',
  ...overrides,
});

const item = (slug, overrides = {}) => ({
  slug,
  name: slug,
  category: 'tea',
  tags: [],
  variants: [variant()],
  ...overrides,
});

const slugs = (products) => products.map((product) => product.slug);

describe('relatedProducts', () => {
  it('returns products of the same category that share a tag', () => {
    const me = item('me', { tags: ['floral', 'green'] });
    const lineup = [
      me,
      item('also-floral', { tags: ['floral'] }),
      item('also-green', { tags: ['green', 'sweet'] }),
    ];
    expect(slugs(relatedProducts(me, lineup))).toEqual(['also-floral', 'also-green']);
  });

  it('never returns the product itself', () => {
    const me = item('me', { tags: ['floral'] });
    expect(relatedProducts(me, [me])).toEqual([]);
  });

  it('leaves out products of another category, even when their tags match', () => {
    const me = item('me', { tags: ['sweet'] });
    const lineup = [me, item('a-coffee', { category: 'coffee', tags: ['sweet'] })];
    expect(relatedProducts(me, lineup)).toEqual([]);
  });

  it('leaves out products that share no tag', () => {
    const me = item('me', { tags: ['floral'] });
    const lineup = [me, item('smoky', { tags: ['smoky'] }), item('bare', { tags: [] })];
    expect(relatedProducts(me, lineup)).toEqual([]);
  });

  it('puts the products that share the most tags first, ties in lineup order', () => {
    const me = item('me', { tags: ['a', 'b', 'c'] });
    const lineup = [
      me,
      item('one-tag-first', { tags: ['a'] }),
      item('three-tags', { tags: ['a', 'b', 'c'] }),
      item('two-tags', { tags: ['b', 'c'] }),
      item('one-tag-second', { tags: ['c'] }),
    ];
    expect(slugs(relatedProducts(me, lineup))).toEqual(['three-tags', 'two-tags', 'one-tag-first']);
  });

  it('returns at most 3 by default', () => {
    const me = item('me', { tags: ['floral'] });
    const lineup = [me, ...['a', 'b', 'c', 'd', 'e'].map((slug) => item(slug, { tags: ['floral'] }))];
    expect(slugs(relatedProducts(me, lineup))).toEqual(['a', 'b', 'c']);
  });

  it('honors a different limit', () => {
    const me = item('me', { tags: ['floral'] });
    const lineup = [me, ...['a', 'b', 'c'].map((slug) => item(slug, { tags: ['floral'] }))];
    expect(slugs(relatedProducts(me, lineup, 2))).toEqual(['a', 'b']);
  });

  it('matches tags without regard to case or spacing', () => {
    const me = item('me', { tags: ['Floral '] });
    const lineup = [me, item('match', { tags: [' floral'] })];
    expect(slugs(relatedProducts(me, lineup))).toEqual(['match']);
  });

  it('counts a repeated tag once', () => {
    const me = item('me', { tags: ['floral', 'floral'] });
    const lineup = [
      me,
      item('one-real', { tags: ['green', 'floral'] }),
      item('repeats', { tags: ['floral', 'floral', 'floral'] }),
    ];
    // Each shares one distinct tag with `me`, so the lineup order stands. Counting
    // repeats would push `repeats` above `one-real`.
    expect(slugs(relatedProducts(me, lineup))).toEqual(['one-real', 'repeats']);
  });

  it('leaves out products with nothing that can be bought', () => {
    const me = item('me', { tags: ['floral'] });
    const lineup = [
      me,
      item('not-synced', { tags: ['floral'], variants: [variant({ stripe_price_id: undefined })] }),
      item('blank-id', { tags: ['floral'], variants: [variant({ stripe_price_id: '   ' })] }),
      item('no-variants', { tags: ['floral'], variants: [] }),
      item('for-sale', { tags: ['floral'] }),
    ];
    expect(slugs(relatedProducts(me, lineup))).toEqual(['for-sale']);
  });

  it('returns nothing for a product with no tags', () => {
    const me = item('me', { tags: [] });
    expect(relatedProducts(me, [me, item('other', { tags: ['floral'] })])).toEqual([]);
  });

  it('copes with missing fields and blank tags', () => {
    const me = item('me', { tags: ['floral', '', '   '] });
    const lineup = [
      me,
      { slug: 'no-tags-field', category: 'tea', variants: [variant()] },
      item('blank-only', { tags: ['', '   '] }),
      item('match', { tags: ['floral'] }),
    ];
    expect(slugs(relatedProducts(me, lineup))).toEqual(['match']);
    expect(relatedProducts(undefined, lineup)).toEqual([]);
    expect(relatedProducts(me, undefined)).toEqual([]);
  });

  it('does not change the lists it is given', () => {
    const me = item('me', { tags: ['b', 'a'] });
    const lineup = [me, item('x', { tags: ['a'] }), item('y', { tags: ['a', 'b'] })];
    const before = JSON.stringify(lineup);
    relatedProducts(me, lineup);
    expect(JSON.stringify(lineup)).toBe(before);
  });
});
