import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  isStoreOpen,
  FREE_SHIPPING_CENTS,
  FLAT_SHIPPING_CENTS,
  MAX_QTY,
  CONTACT_EMAIL,
  DEFAULT_TAX_CODE,
} from './store-config.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isStoreOpen', () => {
  it('is closed when neither flag is set', () => {
    vi.stubEnv('STORE_OPEN', undefined);
    vi.stubEnv('VITE_STORE_OPEN', undefined);
    expect(isStoreOpen()).toBe(false);
  });

  it("is open when STORE_OPEN is 'true' (API functions and scripts)", () => {
    vi.stubEnv('STORE_OPEN', 'true');
    vi.stubEnv('VITE_STORE_OPEN', undefined);
    expect(isStoreOpen()).toBe(true);
  });

  it("is open when VITE_STORE_OPEN is 'true' (the browser bundle)", () => {
    vi.stubEnv('STORE_OPEN', undefined);
    vi.stubEnv('VITE_STORE_OPEN', 'true');
    expect(isStoreOpen()).toBe(true);
  });

  it.each(['TRUE', 'True', '1', 'yes', 'false', ' true', ''])(
    'stays closed for %j, because only the exact string "true" opens the store',
    (value) => {
      vi.stubEnv('STORE_OPEN', value);
      vi.stubEnv('VITE_STORE_OPEN', value);
      expect(isStoreOpen()).toBe(false);
    },
  );

});

describe('shared constants', () => {
  it('keeps the agreed placeholder shipping values, in cents', () => {
    expect(FREE_SHIPPING_CENTS).toBe(5000);
    expect(FLAT_SHIPPING_CENTS).toBe(695);
  });

  it('caps a line at 20', () => {
    expect(MAX_QTY).toBe(20);
  });

  it('has a contact email', () => {
    expect(CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it('has a Stripe tax code in txcd_ format', () => {
    expect(DEFAULT_TAX_CODE).toMatch(/^txcd_\d{8}$/);
  });
});
