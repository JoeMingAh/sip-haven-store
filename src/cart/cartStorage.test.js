import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CART_STORAGE_KEY, readStoredLines, writeStoredLines } from './cartStorage.js';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('cart storage', () => {
  it('uses the key siphaven-cart-v2', () => {
    expect(CART_STORAGE_KEY).toBe('siphaven-cart-v2');
  });

  it('writes the lines as JSON under that key', () => {
    const lines = [{ slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 2 }];
    writeStoredLines(lines);
    expect(JSON.parse(window.localStorage.getItem('siphaven-cart-v2'))).toEqual(lines);
  });

  it('reads back what it wrote', () => {
    const lines = [{ slug: 'jasmine-dream', variantId: 'loose-leaf-2oz', qty: 2 }];
    writeStoredLines(lines);
    expect(readStoredLines()).toEqual(lines);
  });

  it('reads null when nothing is stored', () => {
    expect(readStoredLines()).toBeNull();
  });

  it('reads null for text that is not JSON', () => {
    window.localStorage.setItem('siphaven-cart-v2', '{not json');
    expect(readStoredLines()).toBeNull();
  });

  it('hands back whatever shape was stored, for the caller to check', () => {
    window.localStorage.setItem('siphaven-cart-v2', JSON.stringify({ lines: [] }));
    expect(readStoredLines()).toEqual({ lines: [] });
  });

  it('survives storage that refuses reads (private mode, blocked site data)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readStoredLines()).toBeNull();
  });

  it('survives storage that refuses writes (quota full, blocked site data)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => writeStoredLines([])).not.toThrow();
  });

  it('survives a browser with no localStorage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readStoredLines()).toBeNull();
    expect(() => writeStoredLines([])).not.toThrow();
  });
});
