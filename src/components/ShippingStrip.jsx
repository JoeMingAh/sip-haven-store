import { FREE_SHIPPING_CENTS } from '../../lib/store-config.js';
import { formatDollars } from '../format.js';

// "or more", not "over": checkout (api/checkout.js) gives free shipping from the
// threshold itself, and the shipping page says the same.
export default function ShippingStrip() {
  return (
    <p className="bg-sage-deep px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-cream">
      Free shipping on orders of {formatDollars(FREE_SHIPPING_CENTS)} or more
    </p>
  );
}
