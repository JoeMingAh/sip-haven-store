import { describe, it, expect } from 'vitest';
import { STRIPE_PRICE_IDS, buildLineItems } from './checkout.js';

describe('STRIPE_PRICE_IDS', () => {
  it('has an entry for sippers-whisper', () => {
    expect(STRIPE_PRICE_IDS['sippers-whisper']).toBe('price_1TUJ0FLAf4l1OXJTpwFigruL');
  });

  it('has an entry for sippers-murmur', () => {
    expect(STRIPE_PRICE_IDS['sippers-murmur']).toBe('price_1TUJ0aLAf4l1OXJTnViQqXOZ');
  });

  it('does not have entries for placeholder products', () => {
    expect(STRIPE_PRICE_IDS['daybreak-light']).toBeUndefined();
    expect(STRIPE_PRICE_IDS['forge-espresso']).toBeUndefined();
  });
});

describe('buildLineItems', () => {
  it('maps a single known product to a Stripe line item', () => {
    const result = buildLineItems([{ id: 'sippers-whisper', qty: 2 }]);
    expect(result).toEqual([
      { price: 'price_1TUJ0FLAf4l1OXJTpwFigruL', quantity: 2 },
    ]);
  });

  it('maps multiple known products', () => {
    const result = buildLineItems([
      { id: 'sippers-whisper', qty: 1 },
      { id: 'sippers-murmur', qty: 3 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ price: 'price_1TUJ0FLAf4l1OXJTpwFigruL', quantity: 1 });
    expect(result[1]).toEqual({ price: 'price_1TUJ0aLAf4l1OXJTnViQqXOZ', quantity: 3 });
  });

  it('throws for an unknown product id', () => {
    expect(() => buildLineItems([{ id: 'fake-product', qty: 1 }]))
      .toThrow('Unknown product: fake-product');
  });

  it('throws if any item in a mixed cart is unknown', () => {
    expect(() => buildLineItems([
      { id: 'sippers-whisper', qty: 1 },
      { id: 'not-real', qty: 1 },
    ])).toThrow('Unknown product: not-real');
  });
});
