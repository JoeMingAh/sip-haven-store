import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MAX_QTY } from '../../lib/store-config.js';
import { JASMINE, DAWN } from '../test/fixtures.js';
import { CartProvider, useCart, STALE_NOTICE } from './CartContext.jsx';

// The cart looks variants up in the lineup, so each test sets one here.
const lineup = vi.hoisted(() => ({ products: [] }));
vi.mock('../../lib/catalog.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, findVariant: (slug, id) => actual.findVariant(slug, id, lineup) };
});

const KEY = 'siphaven-cart-v2';

beforeEach(() => {
  lineup.products = [JASMINE, DAWN];
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const line = (slug, variantId, qty = 1) => ({ slug, variantId, qty });
const LOOSE = line('jasmine-dream', 'loose-leaf-2oz');
const GROUND = line('dawn-roast', 'ground-12oz');

// Put something in storage before the cart loads.
const seed = (value) =>
  window.localStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value));
const saved = () => JSON.parse(window.localStorage.getItem(KEY));

function renderCart() {
  return renderHook(() => useCart(), { wrapper: CartProvider });
}

describe('CartProvider: a new cart', () => {
  it('starts empty, closed and without a notice', () => {
    const { result } = renderCart();
    expect(result.current.lines).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.subtotalCents).toBe(0);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.notice).toBe('');
  });

  it('exposes the whole cart interface', () => {
    const { result } = renderCart();
    for (const name of ['add', 'setQty', 'remove', 'clear', 'open', 'close']) {
      expect(result.current[name], name).toBeTypeOf('function');
    }
  });
});

describe('CartProvider: add', () => {
  it('puts a line in the cart, one by default', () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz'));
    expect(result.current.lines).toEqual([LOOSE]);
  });

  it('takes a quantity', () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz', 3));
    expect(result.current.lines).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 3)]);
  });

  it('raises the quantity when the same variant is added again', () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz'));
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz', 2));
    expect(result.current.lines).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 3)]);
  });

  it('keeps a separate line for each variant, so the chosen grind is never dropped', () => {
    const { result } = renderCart();
    act(() => result.current.add('dawn-roast', 'whole-bean-12oz'));
    act(() => result.current.add('dawn-roast', 'ground-12oz'));
    expect(result.current.lines).toEqual([
      line('dawn-roast', 'whole-bean-12oz'),
      line('dawn-roast', 'ground-12oz'),
    ]);
  });

  it(`stops at ${MAX_QTY}`, () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz', 18));
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz', 18));
    expect(result.current.lines).toEqual([line('jasmine-dream', 'loose-leaf-2oz', MAX_QTY)]);
  });

  it.each([
    ['an unknown product', 'nope', 'loose-leaf-2oz'],
    ['an unknown variant', 'jasmine-dream', 'nope'],
    ['a variant that is not synced to Stripe', 'jasmine-dream', 'k-cup-12'],
  ])('refuses %s', (_name, slug, variantId) => {
    const { result } = renderCart();
    act(() => result.current.add(slug, variantId));
    expect(result.current.lines).toEqual([]);
  });
});

describe('CartProvider: setQty, remove and clear', () => {
  it('setQty sets the quantity of one line', () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz'));
    act(() => result.current.add('dawn-roast', 'ground-12oz'));
    act(() => result.current.setQty('dawn-roast', 'ground-12oz', 5));
    expect(result.current.lines).toEqual([LOOSE, line('dawn-roast', 'ground-12oz', 5)]);
  });

  it(`setQty stays between 1 and ${MAX_QTY}`, () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz', 4));
    act(() => result.current.setQty('jasmine-dream', 'loose-leaf-2oz', 0));
    expect(result.current.lines[0].qty).toBe(1);
    act(() => result.current.setQty('jasmine-dream', 'loose-leaf-2oz', 100));
    expect(result.current.lines[0].qty).toBe(MAX_QTY);
  });

  it('remove deletes one line and leaves the rest', () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz'));
    act(() => result.current.add('dawn-roast', 'ground-12oz'));
    act(() => result.current.remove('jasmine-dream', 'loose-leaf-2oz'));
    expect(result.current.lines).toEqual([GROUND]);
  });

  it('clear empties the cart and the notice', () => {
    seed([LOOSE, line('gone', 'gone')]);
    const { result } = renderCart();
    expect(result.current.notice).toBe(STALE_NOTICE);
    act(() => result.current.clear());
    expect(result.current.lines).toEqual([]);
    expect(result.current.notice).toBe('');
  });
});

describe('CartProvider: totals', () => {
  it('gives the subtotal in cents from the lineup prices', () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz', 2));
    act(() => result.current.add('dawn-roast', 'ground-12oz', 3));
    expect(result.current.subtotalCents).toBe(2 * 1800 + 3 * 1650);
  });

  it('counts the units in the cart', () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz', 2));
    act(() => result.current.add('dawn-roast', 'ground-12oz', 3));
    expect(result.current.count).toBe(5);
  });
});

describe('CartProvider: the drawer', () => {
  it('open and close flip isOpen', () => {
    const { result } = renderCart();
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('closing the drawer clears the notice, once the shopper has had the chance to read it', () => {
    seed([line('gone', 'gone')]);
    const { result } = renderCart();
    act(() => result.current.open());
    expect(result.current.notice).toBe(STALE_NOTICE);
    act(() => result.current.close());
    expect(result.current.notice).toBe('');
  });

  it('keeps the notice if close is called while the drawer was never open', () => {
    seed([line('gone', 'gone')]);
    const { result } = renderCart();
    act(() => result.current.close());
    expect(result.current.notice).toBe(STALE_NOTICE);
  });

  it('keeps the same functions between renders, so an effect can depend on them', () => {
    const { result, rerender } = renderCart();
    const before = result.current;
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz'));
    rerender();
    for (const name of ['add', 'setQty', 'remove', 'clear', 'open', 'close']) {
      expect(result.current[name], name).toBe(before[name]);
    }
  });
});

describe('CartProvider: saving', () => {
  it('saves every change under siphaven-cart-v2 as a list of { slug, variantId, qty }', () => {
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz', 2));
    act(() => result.current.add('dawn-roast', 'ground-12oz'));
    expect(saved()).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 2), GROUND]);
    act(() => result.current.setQty('dawn-roast', 'ground-12oz', 4));
    expect(saved()).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 2), line('dawn-roast', 'ground-12oz', 4)]);
    act(() => result.current.remove('jasmine-dream', 'loose-leaf-2oz'));
    expect(saved()).toEqual([line('dawn-roast', 'ground-12oz', 4)]);
  });

  it('clear empties the saved cart as well', () => {
    seed([LOOSE]);
    const { result } = renderCart();
    act(() => result.current.clear());
    expect(saved()).toEqual([]);
  });

  it('keeps working when storage refuses writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { result } = renderCart();
    act(() => result.current.add('jasmine-dream', 'loose-leaf-2oz'));
    expect(result.current.lines).toEqual([LOOSE]);
  });
});

describe('CartProvider: loading', () => {
  it('restores the saved lines', () => {
    seed([line('jasmine-dream', 'loose-leaf-2oz', 2), GROUND]);
    const { result } = renderCart();
    expect(result.current.lines).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 2), GROUND]);
    expect(result.current.notice).toBe('');
    expect(result.current.subtotalCents).toBe(2 * 1800 + 1650);
  });

  it('drops stale cart lines', () => {
    // A variant that a later lineup removed, next to one that is still sold.
    seed([line('jasmine-dream', 'loose-leaf-1lb', 2), GROUND]);
    const { result } = renderCart();
    expect(result.current.lines).toEqual([GROUND]);
    expect(result.current.notice).toBe(
      'Some items in your cart are no longer available and were removed.',
    );
    expect(result.current.notice).toBe(STALE_NOTICE);
    // The cleaned cart is what is saved, so the stale line is gone for good.
    expect(saved()).toEqual([GROUND]);
  });

  it('drops lines for a product that left the lineup', () => {
    seed([line('retired-tea', 'loose-leaf-2oz'), LOOSE]);
    const { result } = renderCart();
    expect(result.current.lines).toEqual([LOOSE]);
    expect(result.current.notice).toBe(STALE_NOTICE);
  });

  it('drops a variant that has no stripe_price_id', () => {
    seed([line('jasmine-dream', 'k-cup-12')]);
    const { result } = renderCart();
    expect(result.current.lines).toEqual([]);
    expect(result.current.notice).toBe(STALE_NOTICE);
  });

  it('shows no notice when nothing was dropped', () => {
    seed([LOOSE]);
    expect(renderCart().result.current.notice).toBe('');
  });

  it('starts empty from text that is not JSON, and saves a clean cart over it', () => {
    seed('{this is not json');
    const { result } = renderCart();
    expect(result.current.lines).toEqual([]);
    expect(result.current.notice).toBe('');
    expect(saved()).toEqual([]);
  });

  it.each([
    ['an object', { lines: [LOOSE] }],
    ['a string', 'loose-leaf-2oz'],
    ['a number', 12],
    ['null', null],
  ])('starts empty when the saved value is %s (the wrong shape)', (_name, value) => {
    seed(JSON.stringify(value));
    const { result } = renderCart();
    expect(result.current.lines).toEqual([]);
    expect(result.current.notice).toBe('');
  });

  it('starts empty when storage refuses reads', () => {
    seed([LOOSE]);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const { result } = renderCart();
    expect(result.current.lines).toEqual([]);
    expect(result.current.notice).toBe('');
  });
});

describe('CartProvider: another tab', () => {
  // Another tab of the same site changes the saved cart; the browser tells this one
  // with a storage event. jsdom has no second tab, so the tests change storage
  // themselves and send the event.
  const anotherTabChanged = (key = KEY) =>
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key }));
    });

  it('follows a cart that another tab saved', () => {
    const { result } = renderCart();
    seed([line('jasmine-dream', 'loose-leaf-2oz', 2), GROUND]);
    anotherTabChanged();
    expect(result.current.lines).toEqual([line('jasmine-dream', 'loose-leaf-2oz', 2), GROUND]);
    expect(result.current.count).toBe(3);
    expect(result.current.subtotalCents).toBe(2 * 1800 + 1650);
  });

  it('follows another tab emptying the cart, as after an order', () => {
    seed([LOOSE]);
    const { result } = renderCart();
    window.localStorage.setItem(KEY, '[]');
    anotherTabChanged();
    expect(result.current.lines).toEqual([]);
  });

  it('follows the saved cart being removed', () => {
    seed([LOOSE]);
    const { result } = renderCart();
    window.localStorage.removeItem(KEY);
    anotherTabChanged();
    expect(result.current.lines).toEqual([]);
  });

  it('follows all of storage being cleared, which arrives as a null key', () => {
    seed([LOOSE]);
    const { result } = renderCart();
    window.localStorage.clear();
    anotherTabChanged(null);
    expect(result.current.lines).toEqual([]);
  });

  it('does not lose what another tab added when this tab changes the cart next', () => {
    const { result } = renderCart();
    seed([LOOSE]); // the other tab added the jasmine
    anotherTabChanged();
    act(() => result.current.add('dawn-roast', 'ground-12oz'));
    expect(saved()).toEqual([LOOSE, GROUND]);
  });

  it('ignores a change to some other key', () => {
    const { result } = renderCart();
    seed([LOOSE]);
    window.localStorage.setItem('something-else', 'x');
    anotherTabChanged('something-else');
    expect(result.current.lines).toEqual([]);
  });

  it('checks what the other tab saved the way it checks a saved cart on load', () => {
    const { result } = renderCart();
    seed([line('retired-tea', 'loose-leaf-2oz'), line('jasmine-dream', 'loose-leaf-2oz', 75), 'junk']);
    anotherTabChanged();
    expect(result.current.lines).toEqual([line('jasmine-dream', 'loose-leaf-2oz', MAX_QTY)]);
  });

  it('is an empty cart if what the other tab saved is not a cart', () => {
    seed([LOOSE]);
    const { result } = renderCart();
    seed('{not json');
    anotherTabChanged();
    expect(result.current.lines).toEqual([]);
  });

  it('leaves the drawer and the notice alone', () => {
    seed([line('retired-tea', 'loose-leaf-2oz')]);
    const { result } = renderCart();
    act(() => result.current.open());
    seed([LOOSE]);
    anotherTabChanged();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.notice).toBe(STALE_NOTICE);
  });

  it('does not change the cart object when nothing in it changed', () => {
    seed([LOOSE]);
    const { result } = renderCart();
    const before = result.current;
    anotherTabChanged();
    expect(result.current).toBe(before);
  });

  it('stops listening once the cart is gone', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderCart();
    unmount();
    expect(remove.mock.calls.some(([type]) => type === 'storage')).toBe(true);
  });
});

describe('useCart', () => {
  it('says what is wrong when there is no CartProvider above it', () => {
    // React logs the error it throws; keep the test output quiet.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useCart())).toThrow(/CartProvider/);
  });
});
