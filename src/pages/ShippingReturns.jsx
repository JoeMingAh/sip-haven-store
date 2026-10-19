import { Link } from 'react-router-dom';
import { FLAT_SHIPPING_CENTS, FREE_SHIPPING_CENTS } from '../../lib/store-config.js';
import { formatDollars } from '../format.js';

const SECTION_HEADING = 'mt-10 font-serif text-2xl font-semibold text-sage-deep';
const BODY = 'mt-4 text-pretty text-lg leading-relaxed';

/**
 * /shipping-returns. The shipping terms come from lib/store-config.js, the one place
 * the free-shipping threshold and the flat rate are set, so this page always agrees
 * with the shipping strip, the cart and checkout. Checkout offers free shipping from
 * the threshold up (api/checkout.js uses >=), hence "or more".
 *
 * The only promise about a problem order is the one Joseph gave. There is no return
 * window, refund or exchange offer, and no delivery time, because none has been
 * decided: add them here when Joseph does.
 */
export default function ShippingReturns() {
  return (
    <div className="mx-auto max-w-prose px-4 py-10 md:py-14">
      {/* DRAFT COPY: needs Joseph's approval */}
      <h1 className="text-balance font-serif text-4xl font-semibold leading-tight text-sage-deep md:text-5xl">
        Shipping and returns
      </h1>

      <h2 className={SECTION_HEADING}>Shipping</h2>
      <p className={BODY}>We ship to addresses in the United States.</p>
      <p className={BODY}>
        Orders of {formatDollars(FREE_SHIPPING_CENTS)} or more ship free. Smaller orders ship for a
        flat {formatDollars(FLAT_SHIPPING_CENTS)}.
      </p>
      <p className={BODY}>You'll see your shipping cost at checkout, before you pay.</p>

      <h2 className={SECTION_HEADING}>Returns</h2>
      <p className={BODY}>
        <Link
          to="/contact"
          className="font-semibold text-sage-deep underline underline-offset-4 hover:no-underline"
        >
          Contact us
        </Link>{' '}
        if anything arrives damaged and we'll make it right.
      </p>
    </div>
  );
}
