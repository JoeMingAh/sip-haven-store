import { FREE_SHIPPING_CENTS } from '../../lib/store-config.js';
import { formatPrice } from '../format.js';

/**
 * How close the cart is to free shipping: a line of words and a bar that fills as
 * the subtotal nears FREE_SHIPPING_CENTS (lib/store-config.js). The bar reads as a
 * progress bar to a screen reader, with the same words as its value.
 */
export default function FreeShippingProgress({ subtotalCents }) {
  // Anything that is not a sensible amount counts as an empty cart.
  const subtotal = Number.isFinite(subtotalCents) ? Math.max(0, subtotalCents) : 0;
  const earned = subtotal >= FREE_SHIPPING_CENTS;
  const message = earned
    ? "You've earned free shipping"
    : `${formatPrice(FREE_SHIPPING_CENTS - subtotal)} away from free shipping`;

  const progress = Math.min(subtotal, FREE_SHIPPING_CENTS);
  // Rounded down, so the bar is never full before the shipping is earned.
  const percent = Math.floor((progress / FREE_SHIPPING_CENTS) * 100);

  return (
    <div>
      <p className="text-sm font-semibold text-sage-deep">{message}</p>
      <div
        role="progressbar"
        aria-label="Free shipping progress"
        aria-valuemin={0}
        aria-valuemax={FREE_SHIPPING_CENTS}
        aria-valuenow={progress}
        aria-valuetext={message}
        className="mt-2 h-2 overflow-hidden rounded-full bg-wood"
      >
        <div
          className="h-full rounded-full bg-sage-deep transition-[width] motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
