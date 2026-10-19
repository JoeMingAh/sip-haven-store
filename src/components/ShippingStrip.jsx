import { FREE_SHIPPING_CENTS } from '../../lib/store-config.js';

// 5000 -> "$50", 4950 -> "$49.50"
function dollars(cents) {
  const isWholeDollar = cents % 100 === 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: isWholeDollar ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default function ShippingStrip() {
  return (
    <p className="bg-sage-deep px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-cream">
      Free shipping on orders over {dollars(FREE_SHIPPING_CENTS)}
    </p>
  );
}
