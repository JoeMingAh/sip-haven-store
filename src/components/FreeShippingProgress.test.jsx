import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FREE_SHIPPING_CENTS } from '../../lib/store-config.js';
import FreeShippingProgress from './FreeShippingProgress.jsx';

const bar = () => screen.getByRole('progressbar');

afterEach(() => {
  vi.doUnmock('../../lib/store-config.js');
  vi.resetModules();
});

describe('FreeShippingProgress', () => {
  it('reads "$10.00 away from free shipping" at a subtotal of 4000', () => {
    render(<FreeShippingProgress subtotalCents={4000} />);
    expect(screen.getByText('$10.00 away from free shipping')).toBeInTheDocument();
  });

  it.each([
    [0, '$50.00 away from free shipping'],
    [1, '$49.99 away from free shipping'],
    [2550, '$24.50 away from free shipping'],
    [4999, '$0.01 away from free shipping'],
  ])('at a subtotal of %i it reads "%s"', (cents, text) => {
    render(<FreeShippingProgress subtotalCents={cents} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each([FREE_SHIPPING_CENTS, FREE_SHIPPING_CENTS + 1, 12000])(
    'says the shipping is earned at a subtotal of %i',
    (cents) => {
      render(<FreeShippingProgress subtotalCents={cents} />);
      expect(screen.getByText("You've earned free shipping")).toBeInTheDocument();
      expect(screen.queryByText(/away from free shipping/)).not.toBeInTheDocument();
    },
  );

  it('measures against the threshold in lib/store-config.js', () => {
    render(<FreeShippingProgress subtotalCents={FREE_SHIPPING_CENTS - 1} />);
    expect(screen.getByText('$0.01 away from free shipping')).toBeInTheDocument();
  });

  it('draws the progress as a bar that fills toward the threshold', () => {
    const { rerender } = render(<FreeShippingProgress subtotalCents={4000} />);
    expect(bar()).toHaveAttribute('aria-valuemin', '0');
    expect(bar()).toHaveAttribute('aria-valuemax', String(FREE_SHIPPING_CENTS));
    expect(bar()).toHaveAttribute('aria-valuenow', '4000');
    expect(bar().firstElementChild).toHaveStyle({ width: '80%' });

    rerender(<FreeShippingProgress subtotalCents={0} />);
    expect(bar()).toHaveAttribute('aria-valuenow', '0');
    expect(bar().firstElementChild).toHaveStyle({ width: '0%' });
  });

  // The track is wood on a cream cart, which is 1.23:1, so on its own it cannot be seen
  // and an empty bar looks like no bar. A sage outline (3.7:1 on cream) shows its length.
  it.each([0, 4000, FREE_SHIPPING_CENTS])(
    'outlines the track in sage at a subtotal of %i, so its whole length shows',
    (cents) => {
      render(<FreeShippingProgress subtotalCents={cents} />);
      expect(bar()).toHaveClass('border', 'border-sage');
    },
  );

  it('fills the bar and stops at full once the shipping is earned', () => {
    render(<FreeShippingProgress subtotalCents={FREE_SHIPPING_CENTS * 3} />);
    expect(bar()).toHaveAttribute('aria-valuenow', String(FREE_SHIPPING_CENTS));
    expect(bar().firstElementChild).toHaveStyle({ width: '100%' });
  });

  it('is never full before the shipping is earned, even one cent short', () => {
    render(<FreeShippingProgress subtotalCents={FREE_SHIPPING_CENTS - 1} />);
    expect(bar().firstElementChild).toHaveStyle({ width: '99%' });
    expect(bar()).toHaveAttribute('aria-valuenow', String(FREE_SHIPPING_CENTS - 1));
  });

  it('follows whatever threshold lib/store-config.js sets, and keeps none of its own', async () => {
    vi.resetModules();
    vi.doMock('../../lib/store-config.js', async (importOriginal) => ({
      ...(await importOriginal()),
      FREE_SHIPPING_CENTS: 12000,
    }));
    const { default: Progress } = await import('./FreeShippingProgress.jsx');

    const { rerender } = render(<Progress subtotalCents={4000} />);
    expect(screen.getByText('$80.00 away from free shipping')).toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-valuemax', '12000');
    expect(bar().firstElementChild).toHaveStyle({ width: '33%' });

    // Past $50, the placeholder threshold, but well short of this one.
    rerender(<Progress subtotalCents={6000} />);
    expect(screen.getByText('$60.00 away from free shipping')).toBeInTheDocument();
    expect(screen.queryByText("You've earned free shipping")).not.toBeInTheDocument();

    rerender(<Progress subtotalCents={12000} />);
    expect(screen.getByText("You've earned free shipping")).toBeInTheDocument();
  });

  it('gives the bar the same words as the line above it, for a screen reader', () => {
    render(<FreeShippingProgress subtotalCents={4000} />);
    expect(bar()).toHaveAccessibleName('Free shipping progress');
    expect(bar()).toHaveAttribute('aria-valuetext', '$10.00 away from free shipping');
  });

  it.each([-500, NaN, undefined])('treats a subtotal of %s as nothing', (cents) => {
    render(<FreeShippingProgress subtotalCents={cents} />);
    expect(screen.getByText('$50.00 away from free shipping')).toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-valuenow', '0');
  });
});
