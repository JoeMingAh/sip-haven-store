import { FREE_SHIPPING_CENTS } from '../../lib/store-config.js';
import { formatDollars } from '../format.js';

export default function ShippingStrip() {
  return (
    <p className="bg-sage-deep px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-cream">
      Free shipping on orders over {formatDollars(FREE_SHIPPING_CENTS)}
    </p>
  );
}
