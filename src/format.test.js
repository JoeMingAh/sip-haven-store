import { describe, it, expect } from 'vitest';
import { formatLabel, formatPrice } from './format.js';

describe('formatPrice', () => {
  it.each([
    [1800, '$18.00'],
    [1850, '$18.50'],
    [999, '$9.99'],
    [1, '$0.01'],
    [0, '$0.00'],
    [1000, '$10.00'],
    [12000, '$120.00'],
    [123456, '$1,234.56'],
  ])('writes %i cents as %s', (cents, text) => {
    expect(formatPrice(cents)).toBe(text);
  });

  it('keeps the cents on a whole-dollar amount, so a total never changes shape', () => {
    expect(formatPrice(5000)).toBe('$50.00');
  });
});

describe('formatLabel', () => {
  it.each([
    ['loose-leaf', 'Loose leaf'],
    ['tea-bags', 'Tea bags'],
    ['k-cup', 'K-Cup'],
    ['whole-bean', 'Whole bean'],
    ['ground', 'Ground'],
  ])('names %s as %s', (format, label) => {
    expect(formatLabel(format)).toBe(label);
  });

  it('shows a format the shop has no name for as it is', () => {
    expect(formatLabel('cold-brew')).toBe('cold-brew');
  });

  it('does not mistake a word on every object for a format', () => {
    expect(formatLabel('constructor')).toBe('constructor');
    expect(formatLabel('toString')).toBe('toString');
  });
});
