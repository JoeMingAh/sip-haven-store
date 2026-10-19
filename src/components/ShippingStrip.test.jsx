import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ShippingStrip from './ShippingStrip.jsx';

// The strip must follow lib/store-config.js, so the test changes the threshold.
const config = vi.hoisted(() => ({ cents: 5000 }));
vi.mock('../../lib/store-config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FREE_SHIPPING_CENTS() {
    return config.cents;
  },
}));

describe('ShippingStrip', () => {
  it('shows the configured threshold in whole dollars', () => {
    config.cents = 5000;
    render(<ShippingStrip />);
    expect(screen.getByText('Free shipping on orders over $50')).toBeInTheDocument();
  });

  it('is computed from FREE_SHIPPING_CENTS, not hard-coded', () => {
    config.cents = 7500;
    render(<ShippingStrip />);
    expect(screen.getByText('Free shipping on orders over $75')).toBeInTheDocument();
  });

  it('keeps the cents when the threshold is not a whole dollar', () => {
    config.cents = 4950;
    render(<ShippingStrip />);
    expect(screen.getByText('Free shipping on orders over $49.50')).toBeInTheDocument();
  });
});
