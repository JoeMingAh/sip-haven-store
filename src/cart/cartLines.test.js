import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MAX_QTY } from '../../lib/store-config.js';
import { JASMINE, DAWN } from '../test/fixtures.js';
import {
  addLine,
  isPurchasable,
  itemCount,
  removeLine,
  restoreLines,
  sameLines,
  setLineQty,
  subtotalCents,
} from './cartLines.js';

// The cart rules look variants up in the lineup, so each test sets one here.
const lineup = vi.hoisted(() => ({ products: [] }));
vi.mock('../../lib/catalog.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findVariant: (slug, id) => actual.findVariant(slug, id, lineup) };
});

beforeEach(() => {
  lineup.products = [JASMINE, DAWN];
});

const line = (slug, variantId, qty = 1) => ({ slug, variantId, qty });
const LOOSE = line('jasmine-dream', 'loose-leaf-2oz');
const BAGS = line('jasmine-dream', 'tea-bags-15');
const GROUND = line('dawn-roast', 'ground-12oz');

describe('isPurchasable', () => {
  it('is true for a variant that has a stripe_price_id', () => {
    expect(isPurchasable('jasmine-dream', 'loose-leaf-2oz')).toBe(true);
  });

  it.each([
    ['an unknown product', 'nope', 'loose-leaf-2oz'],
    ['an unknown variant', 'jasmine-dream', 'nope'],
    ['a variant that is not synced to Stripe', 'jasmine-dream', 'k-cup-12'],
    ['a missing slug', undefined, 'loose-leaf-2oz'],
    ['a missing variant id', 'jasmine-dream', undefined],
  ])('is false for %s', (_name, slug, variantId) => {
    expect(isPurchasable(slug, variantId)).toBe(false);
  });

  it.each(['', ' ', '   ', '\t\n'])(
    'is false for a variant whose stripe_price_id is blank (%j), as it is for the server',
    (blank) => {
      lineup.products = [
        {
          ...JASMINE,
          variants: JASMINE.variants.map((variant) =>
            variant.id === 'loose-leaf-2oz' ? { ...variant, stripe_price_id: blank } : variant,
          ),
        },
      ];
      expect(isPurchasable('jasmine-dream', 'loose-leaf-2oz')).toBe(false);
      // Another variant of the same product is not caught by it.
      expect(isPurchasable('jasmine-dream', 'tea-bags-15')).toBe(true);
    },
  );
});

describe('addLine', () => {
  it('adds a new line, one by default', () => {
    expect(addLine([], 'jasmine-dream', 'loose-leaf-2oz')).toEqual([LOOSE]);
  });

  it('adds the quantity asked for', () => {
    expect(addLine([], 'jasmine-dream', 'loose-leaf-2oz', 3)).toEqual([line(LOOSE.slug, LOOSE.variantId, 3)]);
  });

  it('raises the quantity of a line that is already there instead of adding a second', () => {
    const once = addLine([], 'jasmine-dream', 'loose-leaf-2oz');
    const twice = addLine(once, 'jasmine-dream', 'loose-leaf-2oz', 2);
    expect(twice).toEqual([line(LOOSE.slug, LOOSE.variantId, 3)]);
  });

  it('keeps one line per slug and variant: another variant of the same product is its own line', () => {
    let lines = addLine([], 'jasmine-dream', 'loose-leaf-2oz');
    lines = addLine(lines, 'jasmine-dream', 'tea-bags-15');
    lines = addLine(lines, 'dawn-roast', 'ground-12oz');
    lines = addLine(lines, 'dawn-roast', 'whole-bean-12oz');
    expect(lines).toEqual([
      LOOSE,
      BAGS,
      GROUND,
      line('dawn-roast', 'whole-bean-12oz'),
    ]);
  });

  it(`caps a line at ${MAX_QTY} when more is added to it`, () => {
    const lines = addLine([line(LOOSE.slug, LOOSE.variantId, 15)], 'jasmine-dream', 'loose-leaf-2oz', 10);
    expect(lines).toEqual([line(LOOSE.slug, LOOSE.variantId, MAX_QTY)]);
  });

  it(`caps a single big add at ${MAX_QTY}`, () => {
    expect(addLine([], 'jasmine-dream', 'loose-leaf-2oz', 500)).toEqual([
      line(LOOSE.slug, LOOSE.variantId, MAX_QTY),
    ]);
  });

  it.each([
    ['an unknown product', 'nope', 'loose-leaf-2oz'],
    ['an unknown variant', 'jasmine-dream', 'nope'],
    ['a variant with no stripe_price_id', 'jasmine-dream', 'k-cup-12'],
  ])('refuses %s and leaves the cart as it was', (_name, slug, variantId) => {
    const before = [LOOSE];
    expect(addLine(before, slug, variantId)).toBe(before);
  });

  it.each([0, -1, 1.5, NaN, Infinity, '2', null])('refuses a quantity of %j', (qty) => {
    const before = [LOOSE];
    expect(addLine(before, 'jasmine-dream', 'tea-bags-15', qty)).toBe(before);
  });

  it('does not change the list it is given', () => {
    const before = Object.freeze([Object.freeze({ ...LOOSE })]);
    expect(() => addLine(before, 'jasmine-dream', 'loose-leaf-2oz')).not.toThrow();
    expect(before).toEqual([LOOSE]);
  });
});

describe('setLineQty', () => {
  it('sets the quantity of the matching line', () => {
    expect(setLineQty([LOOSE, BAGS], 'jasmine-dream', 'tea-bags-15', 4)).toEqual([
      LOOSE,
      line(BAGS.slug, BAGS.variantId, 4),
    ]);
  });

  it('never goes below 1: the remove button is how a line goes away', () => {
    expect(setLineQty([line(LOOSE.slug, LOOSE.variantId, 3)], 'jasmine-dream', 'loose-leaf-2oz', 0)).toEqual([
      LOOSE,
    ]);
    expect(setLineQty([LOOSE], 'jasmine-dream', 'loose-leaf-2oz', -5)).toEqual([LOOSE]);
  });

  it(`never goes above ${MAX_QTY}`, () => {
    expect(setLineQty([LOOSE], 'jasmine-dream', 'loose-leaf-2oz', 99)).toEqual([
      line(LOOSE.slug, LOOSE.variantId, MAX_QTY),
    ]);
  });

  it('leaves the cart alone for a line that is not there', () => {
    const before = [LOOSE];
    expect(setLineQty(before, 'dawn-roast', 'ground-12oz', 3)).toBe(before);
  });

  it('leaves the cart alone when the quantity is already that', () => {
    const before = [line(LOOSE.slug, LOOSE.variantId, 3)];
    expect(setLineQty(before, 'jasmine-dream', 'loose-leaf-2oz', 3)).toBe(before);
  });

  it.each([1.5, NaN, Infinity, '2', null, undefined])('ignores a quantity of %j', (qty) => {
    const before = [LOOSE];
    expect(setLineQty(before, 'jasmine-dream', 'loose-leaf-2oz', qty)).toBe(before);
  });
});

describe('removeLine', () => {
  it('removes exactly the matching line', () => {
    expect(removeLine([LOOSE, BAGS, GROUND], 'jasmine-dream', 'tea-bags-15')).toEqual([LOOSE, GROUND]);
  });

  it('leaves the cart alone for a line that is not there', () => {
    const before = [LOOSE];
    expect(removeLine(before, 'jasmine-dream', 'tea-bags-15')).toBe(before);
  });
});

describe('subtotalCents and itemCount', () => {
  it('adds up price times quantity from the lineup, never from the cart', () => {
    const lines = [line('jasmine-dream', 'loose-leaf-2oz', 2), line('dawn-roast', 'ground-12oz', 3)];
    // 2 x $18.00 + 3 x $16.50
    expect(subtotalCents(lines)).toBe(3600 + 4950);
  });

  it('is 0 for an empty cart', () => {
    expect(subtotalCents([])).toBe(0);
  });

  it('counts a line it cannot price as nothing instead of crashing', () => {
    expect(subtotalCents([line('nope', 'nope', 2), LOOSE])).toBe(1800);
  });

  it('counts every unit, not every line', () => {
    expect(itemCount([line('jasmine-dream', 'loose-leaf-2oz', 2), line('dawn-roast', 'ground-12oz', 3)])).toBe(5);
    expect(itemCount([])).toBe(0);
  });
});

describe('restoreLines', () => {
  it('keeps good lines, in order', () => {
    expect(restoreLines([LOOSE, GROUND, BAGS])).toEqual({
      lines: [LOOSE, GROUND, BAGS],
      droppedStale: false,
    });
  });

  it.each([
    ['nothing stored', null],
    ['undefined', undefined],
    ['an object', { lines: [LOOSE] }],
    ['a string', 'jasmine-dream'],
    ['a number', 3],
    ['true', true],
  ])('is an empty cart for %s (the wrong shape)', (_name, stored) => {
    expect(restoreLines(stored)).toEqual({ lines: [], droppedStale: false });
  });

  it('drops lines whose product or variant is no longer in the lineup, and says so', () => {
    expect(restoreLines([LOOSE, line('gone-tea', 'loose-leaf-2oz'), line('jasmine-dream', 'gone-variant')])).toEqual({
      lines: [LOOSE],
      droppedStale: true,
    });
  });

  it('drops a variant that is in the lineup but not synced to Stripe, and says so', () => {
    expect(restoreLines([line('jasmine-dream', 'k-cup-12')])).toEqual({ lines: [], droppedStale: true });
  });

  it('drops a variant whose stripe_price_id is only spaces, as it does one with none', () => {
    lineup.products = [
      {
        ...JASMINE,
        variants: JASMINE.variants.map((variant) =>
          variant.id === 'loose-leaf-2oz' ? { ...variant, stripe_price_id: '   ' } : variant,
        ),
      },
    ];
    expect(restoreLines([LOOSE, BAGS])).toEqual({ lines: [BAGS], droppedStale: true });
  });

  it.each([
    ['null', null],
    ['text', 'jasmine-dream'],
    ['an empty object', {}],
    ['a missing slug', { variantId: 'loose-leaf-2oz', qty: 1 }],
    ['a missing variantId', { slug: 'jasmine-dream', qty: 1 }],
    ['a missing qty', { slug: 'jasmine-dream', variantId: 'loose-leaf-2oz' }],
    ['a numeric slug', { slug: 7, variantId: 'loose-leaf-2oz', qty: 1 }],
    ['a zero qty', line('jasmine-dream', 'loose-leaf-2oz', 0)],
    ['a negative qty', line('jasmine-dream', 'loose-leaf-2oz', -2)],
    ['a fractional qty', line('jasmine-dream', 'loose-leaf-2oz', 1.5)],
    ['a text qty', { slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: '2' }],
  ])('quietly drops an entry that is %s, which our own code never writes', (_name, entry) => {
    expect(restoreLines([entry, BAGS])).toEqual({ lines: [BAGS], droppedStale: false });
  });

  it.each([
    ['a zero qty', 0],
    ['a negative qty', -3],
    ['a fractional qty', 1.5],
    ['a text qty', '2'],
  ])('does not call an entry with %s "stale", even when its product is gone', (_name, qty) => {
    // Stale means something our own code saved that the lineup has since dropped. An
    // entry with a bad quantity is not that, so it must not trigger the notice.
    expect(restoreLines([{ slug: 'retired-tea', variantId: 'loose-leaf-2oz', qty }])).toEqual({
      lines: [],
      droppedStale: false,
    });
  });

  it(`pulls a quantity above ${MAX_QTY} down to ${MAX_QTY} instead of dropping the line`, () => {
    expect(restoreLines([line('jasmine-dream', 'loose-leaf-2oz', 75)])).toEqual({
      lines: [line('jasmine-dream', 'loose-leaf-2oz', MAX_QTY)],
      droppedStale: false,
    });
  });

  it('merges a line that was stored twice', () => {
    expect(
      restoreLines([line('jasmine-dream', 'loose-leaf-2oz', 2), BAGS, line('jasmine-dream', 'loose-leaf-2oz', 3)]),
    ).toEqual({
      lines: [line('jasmine-dream', 'loose-leaf-2oz', 5), BAGS],
      droppedStale: false,
    });
  });

  it('keeps only slug, variantId and qty, so nothing else rides along into checkout', () => {
    const stored = [{ slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 2, price_cents: 1, note: 'x' }];
    expect(restoreLines(stored).lines).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 2)]);
    expect(Object.keys(restoreLines(stored).lines[0]).sort()).toEqual(['qty', 'slug', 'variantId']);
  });
});

describe('sameLines', () => {
  it('is true for the same lines in the same order', () => {
    expect(sameLines([LOOSE, GROUND], [{ ...LOOSE }, { ...GROUND }])).toBe(true);
  });

  it('is true for two empty carts', () => {
    expect(sameLines([], [])).toBe(true);
  });

  it.each([
    ['another quantity', [line('jasmine-dream', 'loose-leaf-2oz', 2), GROUND]],
    ['another variant', [LOOSE, line('dawn-roast', 'whole-bean-12oz')]],
    ['another product', [LOOSE, line('jasmine-dream', 'ground-12oz')]],
    ['another order', [GROUND, LOOSE]],
    ['a line fewer', [LOOSE]],
    ['a line more', [LOOSE, GROUND, BAGS]],
    ['nothing', []],
  ])('is false for %s', (_name, other) => {
    expect(sameLines([LOOSE, GROUND], other)).toBe(false);
  });
});
