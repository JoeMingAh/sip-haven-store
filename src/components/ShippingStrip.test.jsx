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
    expect(screen.getByText('Free shipping on orders of $50 or more')).toBeInTheDocument();
  });

  it('is computed from FREE_SHIPPING_CENTS, not hard-coded', () => {
    config.cents = 7500;
    render(<ShippingStrip />);
    expect(screen.getByText('Free shipping on orders of $75 or more')).toBeInTheDocument();
  });

  it('keeps the cents when the threshold is not a whole dollar', () => {
    config.cents = 4950;
    render(<ShippingStrip />);
    expect(screen.getByText('Free shipping on orders of $49.50 or more')).toBeInTheDocument();
  });

  it('says "or more", because checkout makes an order of exactly the threshold free', () => {
    config.cents = 5000;
    render(<ShippingStrip />);
    // api/checkout.js gives free shipping when the subtotal is >= the threshold, so
    // "over $50" would be wrong for an order of exactly $50.
    expect(screen.getByText(/ or more$/)).toBeInTheDocument();
    expect(screen.queryByText(/\bover\b/i)).not.toBeInTheDocument();
  });
});
